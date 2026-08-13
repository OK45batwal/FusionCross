use std::path::Path;

use crate::core::errors::FusionError;

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct InstallerAnalysis {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub size_bytes: u64,
    /// i386 / x86-64 / arm64 / unknown
    pub arch: &'static str,
    pub suggested_name: String,
    pub is_windows_installer: bool,
}

/// Inspect a `.exe` / `.msi` installer. Parses the portable executable header
/// directly — no external tooling.
pub fn analyze_installer(path: &Path) -> Result<InstallerAnalysis, FusionError> {
    let meta = std::fs::metadata(path).map_err(|_| FusionError::InvalidExecutable)?;
    if !meta.is_file() {
        return Err(FusionError::InvalidExecutable);
    }
    let data = std::fs::read(path).map_err(|_| FusionError::InvalidExecutable)?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let file_name = path
        .file_name()
        .map(|f| f.to_string_lossy().into_owned())
        .unwrap_or_default();
    let stem = path
        .file_stem()
        .map(|s| prettify(&s.to_string_lossy()))
        .unwrap_or_else(|| file_name.clone());

    let is_windows_installer = matches!(ext.as_str(), "exe" | "msi")
        && (data.starts_with(b"MZ") || ext == "msi");
    let arch = if ext == "msi" || !data.starts_with(b"MZ") {
        unknown_or_msi(&data, ext.as_str())
    } else {
        pe_arch(&data)
    };

    if !is_windows_installer {
        return Err(FusionError::InvalidExecutable);
    }

    Ok(InstallerAnalysis {
        path: path.to_string_lossy().into_owned(),
        file_name,
        extension: ext,
        size_bytes: meta.len(),
        arch,
        suggested_name: stem,
        is_windows_installer: true,
    })
}

fn prettify(stem: &str) -> String {
    stem.replace(['_', '.', '-'], " ")
        .split_whitespace()
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn pe_arch(data: &[u8]) -> &'static str {
    // e_lfanew is the 4 bytes at offset 0x3C (PE header offset)
    if data.len() < 0x40 {
        return "unknown";
    }
    let e_lfanew =
        u32::from_le_bytes([data[0x3C], data[0x3D], data[0x3E], data[0x3F]]) as usize;
    let pe = e_lfanew + 4; // skip "PE\0\0"
    if e_lfanew + 8 > data.len() || &data[e_lfanew..e_lfanew + 4] != b"PE\0\0" {
        return "unknown";
    }
    let machine = u16::from_le_bytes([data[pe], data[pe + 1]]);
    match machine {
        0x014C => "i386",
        0x8664 => "x86-64",
        0xAA64 => "arm64",
        _ => "unknown",
    }
}

fn unknown_or_msi(data: &[u8], ext: &str) -> &'static str {
    if ext == "msi" {
        // MSI files are Windows Installer databases; arch isn't in the header.
        "x86-64"
    } else {
        pe_arch(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn fake_exe(arch_machine: Option<u16>, magic: bool) -> PathBuf {
        let mut bytes: Vec<u8> = Vec::new();
        if magic {
            bytes.extend_from_slice(b"MZ");
        }
        while bytes.len() < 0x90 {
            bytes.push(0);
        }
        let e_lfanew: u32 = 0x80;
        bytes[0x3C..0x40].copy_from_slice(&e_lfanew.to_le_bytes());
        bytes[0x80..0x84].copy_from_slice(b"PE\0\0");
        if let Some(machine) = arch_machine {
            bytes[0x84..0x86].copy_from_slice(&machine.to_le_bytes());
        }
        let p = std::env::temp_dir().join(format!("fc_pe_{}.exe", crate::core::ids::new_id()));
        std::fs::write(&p, &bytes).unwrap();
        p
    }

    #[test]
    fn detects_x64_executable() {
        let p = fake_exe(Some(0x8664), true);
        let a = analyze_installer(&p).unwrap();
        assert_eq!(a.arch, "x86-64");
        assert!(a.is_windows_installer);
        std::fs::remove_file(&p).ok();
    }

    #[test]
    fn detects_x86_and_arm() {
        let p32 = fake_exe(Some(0x014C), true);
        assert_eq!(analyze_installer(&p32).unwrap().arch, "i386");
        std::fs::remove_file(&p32).ok();

        let pa = fake_exe(Some(0xAA64), true);
        assert_eq!(analyze_installer(&pa).unwrap().arch, "arm64");
        std::fs::remove_file(&pa).ok();
    }

    #[test]
    fn rejects_non_windows_files() {
        let p = std::env::temp_dir().join(format!("fc_pe_{}.txt", crate::core::ids::new_id()));
        std::fs::write(&p, b"hello world").unwrap();
        assert_eq!(analyze_installer(&p), Err(FusionError::InvalidExecutable));
        std::fs::remove_file(&p).ok();
    }
}
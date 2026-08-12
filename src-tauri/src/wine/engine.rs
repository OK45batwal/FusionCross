// ponytail: trait methods beyond name()/version() land in the prefix/launch layer.
#![allow(dead_code)]
use crate::core::errors::FusionError;

/// Runtime engine abstraction (PRD §32) — the backend never hard-codes one Wine.
///
/// Implementations: Wine Stable, Wine Staging, Wine-GE, Proton-GE, Custom.
/// Layer 1 wires the trait + a real `wine --version` probe; prefix creation and
/// launching land in the next layer.
pub trait RuntimeEngine {
    fn name(&self) -> &str;
    fn version(&self) -> Result<String, FusionError>;
    fn validate(&self) -> Result<(), FusionError>;
    fn create_prefix(&self, _config: PrefixConfig) -> Result<(), FusionError> {
        Err(FusionError::Unsupported)
    }
    fn launch(&self, _request: LaunchRequest) -> Result<ProcessHandle, FusionError> {
        Err(FusionError::Unsupported)
    }
}

/// Wine-based engine. `binary` is the path/name to invoke (e.g. "wine" or a
/// Wine-GE bundle binary). Real prefix/launch behavior arrives next layer.
pub struct WineEngine {
    pub label: String,
    pub binary: String,
}

impl WineEngine {
    pub fn stable() -> Self {
        Self {
            label: "Wine Stable".to_string(),
            binary: "wine".into(),
        }
    }

    pub fn new(label: &str) -> Self {
        // ponytail: known label → binary map; custom runtimes use their own path.
        let binary = match label {
            "wine" | "Wine Stable" | "Wine" => "wine",
            other => other,
        }
        .to_string();
        Self {
            label: if label.is_empty() { "wine" } else { label }.to_string(),
            binary,
        }
    }
}

impl RuntimeEngine for WineEngine {
    fn name(&self) -> &str {
        &self.label
    }

    fn version(&self) -> Result<String, FusionError> {
        let out = std::process::Command::new(&self.binary)
            .arg("--version")
            .output()
            .map_err(|_| FusionError::RuntimeNotFound)?;
        let stdout = String::from_utf8_lossy(&out.stdout).into_owned();
        parse_wine_version(&stdout).ok_or(FusionError::RuntimeNotFound)
    }

    fn validate(&self) -> Result<(), FusionError> {
        self.version().map(|_| ())
    }
}

/// "wine-9.0 (Staging)" / "wine-10.0.1" / "wine-9.0-rc1" → "9.0"
pub fn parse_wine_version(output: &str) -> Option<String> {
    let head = output.split_whitespace().next()?;
    let ver = head.strip_prefix("wine-")?;
    let major: String = ver
        .split('.')
        .next()?
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if major.is_empty() {
        return None;
    }
    let minor: String = ver
        .split('.')
        .nth(1)
        .map(|seg| seg.chars().take_while(|c| c.is_ascii_digit()).collect())
        .unwrap_or_default();
    if minor.is_empty() {
        Some(major)
    } else {
        Some(format!("{major}.{minor}"))
    }
}

#[derive(Debug, Clone)]
pub struct PrefixConfig {
    pub windows_version: String,
    pub graphics: String,
}

#[derive(Debug, Clone)]
pub struct LaunchRequest {
    pub prefix_path: String,
    pub executable_path: String,
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessHandle {
    pub pid: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_wine_versions() {
        assert_eq!(parse_wine_version("wine-9.0 (Staging)"), Some("9.0".into()));
        assert_eq!(parse_wine_version("wine-10.0.1"), Some("10.0".into()));
        assert_eq!(parse_wine_version("wine-9.0-rc1"), Some("9.0".into()));
        assert_eq!(parse_wine_version("not wine"), None);
    }

    #[test]
    fn stable_engine_reports_name() {
        let engine = WineEngine::stable();
        assert_eq!(engine.name(), "Wine Stable");
    }
}

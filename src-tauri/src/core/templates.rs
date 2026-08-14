/// One-click bottle presets (PRD §28). A template only configures a bottle —
/// it never bundles application installers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateConfig {
    pub prefix_type: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub windows_version: &'static str,
    pub graphics: &'static str,
    pub dxvk_enabled: bool,
    pub environment: Vec<(&'static str, &'static str)>,
    pub dll_overrides: Vec<&'static str>,
    pub registry: Vec<(&'static str, &'static str)>,
    /// winetricks verbs, e.g. vcrun2019, corefonts
    pub dependencies: Vec<&'static str>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum TemplateError {
    UnknownTemplate(String),
}

pub const TEMPLATE_TYPES: [&str; 5] = ["gaming", "dxvk-optimized", "productivity", "legacy", "custom"];

pub fn bottle_template(prefix_type: &str) -> Result<TemplateConfig, TemplateError> {
    if !TEMPLATE_TYPES.contains(&prefix_type) {
        return Err(TemplateError::UnknownTemplate(prefix_type.into()));
    }
    Ok(match prefix_type {
        "gaming" => TemplateConfig {
            prefix_type: "gaming",
            label: "Gaming",
            description: "Wide game compatibility in one bottle.",
            windows_version: "win10",
            graphics: "dxvk",
            dxvk_enabled: true,
            environment: vec![],
            dll_overrides: vec![],
            registry: vec![],
            dependencies: vec!["corefonts"],
        },
        "dxvk-optimized" => TemplateConfig {
            prefix_type: "dxvk-optimized",
            label: "DXVK Optimized",
            description: "Best performance for D3D9/10/11 titles.",
            windows_version: "win11",
            graphics: "dxvk",
            dxvk_enabled: true,
            environment: vec![],
            dll_overrides: vec!["d3d9=n;b", "d3d10core=n;b", "d3d11=n;b"],
            registry: vec![
                ("HKCU\\Software\\Wine\\DllOverrides\\d3d9", "native,builtin"),
                ("HKCU\\Software\\Wine\\DllOverrides\\d3d10core", "native,builtin"),
                ("HKCU\\Software\\Wine\\DllOverrides\\d3d11", "native,builtin"),
            ],
            dependencies: vec!["corefonts", "dxvk"],
        },
        "productivity" => TemplateConfig {
            prefix_type: "productivity",
            label: "Productivity",
            description: "Clean Windows 10 for Office-style applications.",
            windows_version: "win10",
            graphics: "wined3d",
            dxvk_enabled: false,
            environment: vec![],
            dll_overrides: vec![],
            registry: vec![],
            dependencies: vec!["corefonts"],
        },
        "legacy" => TemplateConfig {
            prefix_type: "legacy",
            label: "Legacy",
            description: "Windows 7 for very old applications.",
            windows_version: "win7",
            graphics: "wined3d",
            dxvk_enabled: false,
            environment: vec![],
            dll_overrides: vec![],
            registry: vec![],
            dependencies: vec![],
        },
        _ => TemplateConfig {
            prefix_type: "custom",
            label: "Custom",
            description: "Start from a blank slate.",
            windows_version: "win10",
            graphics: "automatic",
            dxvk_enabled: false,
            environment: vec![],
            dll_overrides: vec![],
            registry: vec![],
            dependencies: vec![],
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_template_is_well_formed() {
        for t in TEMPLATE_TYPES {
            let cfg = bottle_template(t).unwrap();
            assert!(!cfg.windows_version.is_empty());
            assert!(!cfg.graphics.is_empty());
        }
    }

    #[test]
    fn gaming_enables_dxvk_but_legacy_does_not() {
        assert!(bottle_template("gaming").unwrap().dxvk_enabled);
        assert!(!bottle_template("legacy").unwrap().dxvk_enabled);
    }

    #[test]
    fn unknown_template_errors() {
        assert!(bottle_template("nope").is_err());
    }
}
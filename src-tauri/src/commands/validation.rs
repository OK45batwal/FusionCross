use crate::core::errors::FusionError;

pub fn name(value: &str) -> Result<(), FusionError> {
    if value.trim().is_empty() || value.len() > 200 || value.chars().any(char::is_control) {
        return Err(FusionError::InvalidInput);
    }
    Ok(())
}

pub fn choice(value: &str, allowed: &[&str]) -> Result<(), FusionError> {
    if allowed.contains(&value) {
        Ok(())
    } else {
        Err(FusionError::InvalidInput)
    }
}

pub fn environment(values: &[(String, String)]) -> Result<(), FusionError> {
    let mut keys = std::collections::HashSet::new();
    for (key, value) in values {
        if key.is_empty()
            || key.contains(['=', '\0'])
            || value.contains('\0')
            || key == "WINEPREFIX"
            || !keys.insert(key)
        {
            return Err(FusionError::InvalidInput);
        }
    }
    Ok(())
}

pub fn setting(key: &str, value: &str) -> Result<(), FusionError> {
    match key {
        "safe_mode" => choice(value, &["on", "off"]),
        "default_arch" => choice(value, &["win32", "win64"]),
        "dxvk_hud" => choice(value, &["compiler,fps", "fps,frametimes", "full", "0"]),
        "wine_binary_path" => {
            use std::os::unix::fs::PermissionsExt;
            let path = std::path::Path::new(value);
            if value.is_empty()
                || (path.is_absolute()
                    && path
                        .metadata()
                        .is_ok_and(|m| m.is_file() && m.permissions().mode() & 0o111 != 0))
            {
                Ok(())
            } else {
                Err(FusionError::InvalidInput)
            }
        }
        _ => Err(FusionError::InvalidInput),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_invalid_settings_and_environment_before_mutation() {
        assert!(name("  ").is_err());
        assert!(setting("default_arch", "arm64").is_err());
        assert!(setting("unknown", "value").is_err());
        assert!(setting("wine_binary_path", "/").is_err());
        assert!(setting("wine_binary_path", "").is_ok());
        assert!(setting("safe_mode", "on").is_ok());
        assert!(environment(&[("WINEPREFIX".into(), "/other".into())]).is_err());
        assert!(environment(&[("BAD=KEY".into(), "x".into())]).is_err());
        assert!(environment(&[("DEBUG".into(), "a\0b".into())]).is_err());
        assert!(environment(&[("WINEDEBUG".into(), "-all".into())]).is_ok());
    }
}

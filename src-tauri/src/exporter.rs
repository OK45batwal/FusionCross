use crate::core::errors::FusionError;
use std::fs;
use std::path::{Path, PathBuf};

/// Generates a native macOS `.app` bundle under `~/Applications/FusionCross/<App Name>.app`
/// allowing Windows applications to be launched directly from Finder, Spotlight, or Dock.
pub fn create_mac_app_bundle(
    app_name: &str,
    app_id: &str,
    target_dir: &Path,
) -> Result<PathBuf, FusionError> {
    let safe_name = app_name.replace(['/', '\\'], "-");
    let bundle_dir = target_dir.join(format!("{}.app", safe_name));
    let contents_dir = bundle_dir.join("Contents");
    let macos_dir = contents_dir.join("MacOS");
    let resources_dir = contents_dir.join("Resources");

    fs::create_dir_all(&macos_dir).map_err(|_| FusionError::InstallationFailed)?;
    fs::create_dir_all(&resources_dir).map_err(|_| FusionError::InstallationFailed)?;

    // 1. Write Info.plist
    let info_plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>org.fusioncross.app.{}</string>
    <key>CFBundleName</key>
    <string>{}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>"#,
        app_id, safe_name
    );

    fs::write(contents_dir.join("Info.plist"), info_plist)
        .map_err(|_| FusionError::InstallationFailed)?;

    // 2. Write executable launcher shell script
    let launcher_script = format!(
        r#"#!/bin/bash
# FusionCross Native macOS Application Launcher
APP_ID="{}"
open -a FusionCross --args --launch "$APP_ID"
"#,
        app_id
    );

    let launcher_path = macos_dir.join("launcher");
    fs::write(&launcher_path, launcher_script).map_err(|_| FusionError::InstallationFailed)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&launcher_path)
            .map_err(|_| FusionError::InstallationFailed)?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&launcher_path, perms).map_err(|_| FusionError::InstallationFailed)?;
    }

    Ok(bundle_dir)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_mac_app_bundle() {
        let dir = std::env::temp_dir().join("fusioncross_test_bundle");
        let bundle = create_mac_app_bundle("Photoshop 2024", "app-123", &dir).unwrap();
        assert!(bundle.exists());
        assert!(bundle.join("Contents/Info.plist").exists());
        assert!(bundle.join("Contents/MacOS/launcher").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}

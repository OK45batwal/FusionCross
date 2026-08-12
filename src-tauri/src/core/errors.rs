// ponytail: not every variant is reachable yet; consumes builds as IPC lands.
#![allow(dead_code)]
use serde::Serialize;

/// Structured error model (PRD §51). Frontend receives `{ code, message, action }`.
///
/// Never a bare string across IPC — always a typed, actionable error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FusionError {
    ApplicationNotFound,
    BottleNotFound,
    RuntimeNotFound,
    InvalidExecutable,
    DependencyMissing,
    GraphicsInitializationFailed,
    InstallationFailed,
    LaunchFailed,
    PermissionDenied,
    InvalidPath,
    ArchiveValidationFailed,
    RuntimeVerificationFailed,
    Unsupported,
}

impl FusionError {
    /// Stable machine-readable code sent to the frontend.
    pub fn code(self) -> &'static str {
        use FusionError::*;
        match self {
            ApplicationNotFound => "APPLICATION_NOT_FOUND",
            BottleNotFound => "BOTTLE_NOT_FOUND",
            RuntimeNotFound => "RUNTIME_NOT_FOUND",
            InvalidExecutable => "INVALID_EXECUTABLE",
            DependencyMissing => "DEPENDENCY_MISSING",
            GraphicsInitializationFailed => "GRAPHICS_INIT_FAILED",
            InstallationFailed => "INSTALLATION_FAILED",
            LaunchFailed => "LAUNCH_FAILED",
            PermissionDenied => "PERMISSION_DENIED",
            InvalidPath => "INVALID_PATH",
            ArchiveValidationFailed => "ARCHIVE_VALIDATION_FAILED",
            RuntimeVerificationFailed => "RUNTIME_VERIFICATION_FAILED",
            Unsupported => "UNSUPPORTED",
        }
    }

    /// Optional suggested action the UI can offer as a button.
    pub fn action(self) -> Option<&'static str> {
        use FusionError::*;
        match self {
            RuntimeNotFound => Some("INSTALL_RUNTIME"),
            DependencyMissing => Some("INSTALL_DEPENDENCY"),
            GraphicsInitializationFailed => Some("SWITCH_GRAPHICS"),
            RuntimeVerificationFailed => Some("REDOWNLOAD_RUNTIME"),
            ArchiveValidationFailed => Some("REDOWNLOAD_RUNTIME"),
            _ => None,
        }
    }
}

impl std::fmt::Display for FusionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        use FusionError::*;
        let msg = match self {
            ApplicationNotFound => "The application could not be found.",
            BottleNotFound => "The bottle could not be found.",
            RuntimeNotFound => "A compatible runtime is missing.",
            InvalidExecutable => "The selected file is not a valid Windows executable.",
            DependencyMissing => "A required dependency is missing.",
            GraphicsInitializationFailed => "The graphics backend failed to initialize.",
            InstallationFailed => "The installation failed.",
            LaunchFailed => "The application failed to launch.",
            PermissionDenied => "Permission denied.",
            InvalidPath => "The path is outside the app's data directory.",
            ArchiveValidationFailed => "The archive failed validation and was discarded.",
            RuntimeVerificationFailed => "The runtime did not match its expected checksum.",
            Unsupported => "This operation is not supported yet.",
        };
        f.write_str(msg)
    }
}

impl std::error::Error for FusionError {}

impl Serialize for FusionError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct ErrorPayload<'a> {
            code: &'a str,
            message: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            action: Option<&'a str>,
        }
        ErrorPayload {
            code: self.code(),
            message: self.to_string(),
            action: self.action(),
        }
        .serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_structured_payload() {
        let json = serde_json::to_value(FusionError::RuntimeNotFound).unwrap();
        assert_eq!(json["code"], "RUNTIME_NOT_FOUND");
        assert_eq!(json["action"], "INSTALL_RUNTIME");
        assert!(json["message"].as_str().unwrap().contains("runtime"));
    }

    #[test]
    fn no_action_for_plain_errors() {
        let json = serde_json::to_value(FusionError::BottleNotFound).unwrap();
        assert!(json.get("action").is_none());
    }
}

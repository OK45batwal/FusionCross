use serde::{Deserialize, Serialize};

pub const CURRENT_SCHEMA_VERSION: u32 = 1;

/// Versioned application metadata (PRD §52).
///
/// The JSON on disk is never fully trusted: it is parsed as a raw `Value`,
/// migrated forward, then sanitized into the typed struct.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub schema_version: u32,
    pub applications: Vec<Application>,
    pub bottles: Vec<Bottle>,
    pub runtimes: Vec<Runtime>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            applications: Vec::new(),
            bottles: Vec::new(),
            runtimes: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bottle {
    pub id: String,
    pub name: String,
    /// Template the bottle was created from: gaming / dxvk-optimized / productivity / legacy / custom
    pub prefix_type: String,
    pub runtime: String,
    pub windows_version: String,
    pub path: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Application {
    pub id: String,
    pub bottle_id: String,
    pub name: String,
    pub executable_path: String,
    pub category: String,
    pub favorite: bool,
    pub launch_count: u64,
    pub play_time_mins: u64,
    pub last_played: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Runtime {
    pub id: String,
    pub name: String,
    /// wine / proton / custom
    pub category: String,
    pub downloaded: bool,
}

impl AppState {
    /// Parse raw disk JSON, migrate it forward, and map onto the typed state.
    /// Unknown keys are dropped; missing keys fall back to defaults.
    pub fn from_raw(raw: &str) -> Result<Self, String> {
        let mut value: serde_json::Value =
            serde_json::from_str(raw).map_err(|e| format!("invalid state.json: {e}"))?;
        migrate(&mut value)?;
        Self::sanitize(value)
    }

    /// Rebuild typed records from stable IDs and sane defaults, never from
    /// serialized paths that may point anywhere.
    fn sanitize(value: serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(value).map_err(|e| format!("state.json out of shape: {e}"))
    }
}

/// Forward-only migration pipeline. Every future schema change appends one
/// step here (PRD §52: "every future schema change must include migration support").
fn migrate(value: &mut serde_json::Value) -> Result<(), String> {
    let mut version = value
        .get("schema_version")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    if version > CURRENT_SCHEMA_VERSION {
        return Err(format!(
            "state.json schema {version} is newer than this build ({CURRENT_SCHEMA_VERSION})"
        ));
    }

    while version < CURRENT_SCHEMA_VERSION {
        match version {
            0 => {
                // Seed the shape from scratch with valid defaults.
                *value = serde_json::json!({
                    "schema_version": 1,
                    "applications": [],
                    "bottles": [],
                    "runtimes": [],
                });
            }
            _ => return Err(format!("unknown state schema version {version}")),
        }
        version += 1;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_json_migrates_to_current() {
        let state = AppState::from_raw("{}").unwrap();
        assert_eq!(state.schema_version, CURRENT_SCHEMA_VERSION);
        assert!(state.applications.is_empty());
        assert!(state.bottles.is_empty());
        assert!(state.runtimes.is_empty());
    }

    #[test]
    fn versioned_json_roundtrips() {
        let raw = r#"{
            "schema_version": 1,
            "bottles": [{
                "id": "abc", "name": "Gaming", "prefix_type": "gaming",
                "runtime": "Wine Stable", "windows_version": "win10",
                "path": "/data/bottles/abc", "created_at": "2026-08-12T00:00:00Z",
                "last_used_at": null
            }],
            "applications": [],
            "runtimes": []
        }"#;
        let state = AppState::from_raw(raw).unwrap();
        assert_eq!(state.bottles.len(), 1);
        assert_eq!(state.bottles[0].name, "Gaming");
        assert_eq!(state.bottles[0].prefix_type, "gaming");
    }

    #[test]
    fn future_schema_is_rejected() {
        let raw = r#"{"schema_version": 99}"#;
        assert!(AppState::from_raw(raw).is_err());
    }

    #[test]
    fn state_defaults_to_current_version() {
        assert_eq!(AppState::default().schema_version, CURRENT_SCHEMA_VERSION);
    }
}

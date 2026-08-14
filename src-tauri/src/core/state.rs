use serde::{Deserialize, Serialize};

pub const CURRENT_SCHEMA_VERSION: u32 = 2;

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
    pub snapshots: Vec<Snapshot>,
    pub settings: Vec<(String, String)>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION,
            applications: Vec::new(),
            bottles: Vec::new(),
            runtimes: Vec::new(),
            snapshots: Vec::new(),
            settings: vec![("safe_mode".into(), "off".into())],
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
    pub graphics: String,
    pub dxvk_enabled: bool,
    pub path: String,
    pub created_at: String,
    pub last_used_at: Option<String>,
    #[serde(default)]
    pub environment: Vec<(String, String)>,
    #[serde(default)]
    pub dll_overrides: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
}

impl Bottle {
    #[allow(dead_code)]
    pub fn data_dir(&self) -> String {
        // Whatever lives under prefix/drive_c is user data; never written by us.
        self.path.clone()
    }
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
    #[serde(default)]
    pub compatibility: Option<u32>,
    /// Compatibility profile hint learned/applied for this app (e.g. "photoshop")
    #[serde(default)]
    pub profile: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Runtime {
    pub id: String,
    pub name: String,
    /// wine / proton / custom
    pub category: String,
    pub downloaded: bool,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub sha256: String,
    #[serde(default)]
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub id: String,
    pub bottle_id: String,
    pub name: String,
    /// Absolute path to the compressed archive
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

impl AppState {
    /// Parse raw disk JSON, migrate it forward, and map onto the typed state.
    pub fn from_raw(raw: &str) -> Result<Self, String> {
        let mut value: serde_json::Value =
            serde_json::from_str(raw).map_err(|e| format!("invalid state.json: {e}"))?;
        migrate(&mut value)?;
        Self::sanitize(value)
    }

    fn sanitize(value: serde_json::Value) -> Result<Self, String> {
        serde_json::from_value(value).map_err(|e| format!("state.json out of shape: {e}"))
    }
}

/// Forward-only migration pipeline. Every future schema change appends one
/// step here (PRD §52).
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
                *value = serde_json::json!({
                    "schema_version": 1,
                    "applications": [],
                    "bottles": [],
                    "runtimes": [],
                });
            }
            1 => {
                // v2: additive fields. Existing records keep their data; new
                // keys default. Migrating an empty v1 store shapes the skeleton.
                let obj = value.as_object_mut().ok_or("state not an object")?;
                if let Some(runtimes) = obj.get_mut("runtimes").and_then(|r| r.as_array_mut()) {
                    for rt in runtimes.iter_mut() {
                        if let Some(o) = rt.as_object_mut() {
                            for key in ["version", "path", "url", "sha256"] {
                                o.entry(key).or_insert_with(|| serde_json::json!(""));
                            }
                            o.entry("size_bytes").or_insert_with(|| serde_json::json!(0));
                        }
                    }
                }
                if let Some(bottles) = obj.get_mut("bottles").and_then(|b| b.as_array_mut()) {
                    for bo in bottles.iter_mut() {
                        if let Some(o) = bo.as_object_mut() {
                            o.entry("graphics").or_insert_with(|| serde_json::json!("automatic"));
                            o.entry("dxvk_enabled").or_insert_with(|| serde_json::json!(false));
                            o.entry("environment").or_insert_with(|| serde_json::json!([]));
                            o.entry("dll_overrides").or_insert_with(|| serde_json::json!([]));
                            o.entry("dependencies").or_insert_with(|| serde_json::json!([]));
                        }
                    }
                }
                if let Some(apps) = obj.get_mut("applications").and_then(|a| a.as_array_mut()) {
                    for ap in apps.iter_mut() {
                        if let Some(o) = ap.as_object_mut() {
                            o.entry("compatibility").or_insert_with(|| serde_json::json!(null));
                            o.entry("profile").or_insert_with(|| serde_json::json!(null));
                        }
                    }
                }
                obj.entry("snapshots").or_insert_with(|| serde_json::json!([]));
                obj.entry("settings")
                    .or_insert_with(|| serde_json::json!([["safe_mode", "off"]]));
                obj.insert("schema_version".into(), serde_json::json!(2));
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
        assert_eq!(state.settings.len(), 1);
    }

    #[test]
    fn v1_json_migrates_additive_fields() {
        let raw = r#"{
            "schema_version": 1,
            "bottles": [{
                "id": "abc", "name": "Gaming", "prefix_type": "gaming",
                "runtime": "Wine Stable", "windows_version": "win10",
                "path": "/data/bottles/abc", "created_at": "2026-08-12T00:00:00Z", "last_used_at": null
            }],
            "applications": [],
            "runtimes": [{"id":"r1","name":"Wine Stable","category":"wine","downloaded":true}]
        }"#;
        let state = AppState::from_raw(raw).unwrap();
        assert_eq!(state.schema_version, 2);
        assert_eq!(state.bottles[0].graphics, "automatic");
        assert_eq!(state.bottles[0].dll_overrides.len(), 0);
        assert_eq!(state.runtimes[0].version, "");
        assert_eq!(state.snapshots.len(), 0);
    }

    #[test]
    fn future_schema_is_rejected() {
        let raw = r#"{"schema_version": 99}"#;
        assert!(AppState::from_raw(raw).is_err());
    }

    #[test]
    fn current_schema_roundtrips() {
        let state = AppState::default();
        let json = serde_json::to_string(&state).unwrap();
        let parsed = AppState::from_raw(&json).unwrap();
        assert_eq!(parsed.schema_version, CURRENT_SCHEMA_VERSION);
    }
}
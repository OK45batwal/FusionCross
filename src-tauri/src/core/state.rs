use serde::{Deserialize, Serialize};

pub const CURRENT_SCHEMA_VERSION: u32 = 3;

fn default_true() -> bool {
    true
}

fn default_runtime() -> String {
    "Whisky-Wine (Apple GPTK)".to_string()
}

fn default_win_version() -> String {
    "win10".to_string()
}

fn default_graphics() -> String {
    "automatic".to_string()
}

fn default_prefix_type() -> String {
    "gaming".to_string()
}

fn default_category() -> String {
    "applications".to_string()
}

fn default_created_at() -> String {
    "2026-01-01T00:00:00Z".to_string()
}

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
    #[serde(default = "default_prefix_type")]
    pub prefix_type: String,
    #[serde(default = "default_runtime")]
    pub runtime: String,
    #[serde(default = "default_win_version")]
    pub windows_version: String,
    #[serde(default = "default_graphics")]
    pub graphics: String,
    #[serde(default = "default_true")]
    pub dxvk_enabled: bool,
    #[serde(default = "default_true")]
    pub msync_enabled: bool,
    #[serde(default)]
    pub performance_hud: bool,
    #[serde(default)]
    pub retina_mode: bool,
    pub path: String,
    #[serde(default = "default_created_at")]
    pub created_at: String,
    #[serde(default)]
    pub last_used_at: Option<String>,
    #[serde(default)]
    pub environment: Vec<(String, String)>,
    #[serde(default)]
    pub dll_overrides: Vec<String>,
    #[serde(default)]
    pub dependencies: Vec<String>,
}

impl Bottle {
    #[allow(dead_code, unused)]
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
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub launch_count: u64,
    #[serde(default)]
    pub play_time_mins: u64,
    #[serde(default)]
    pub last_played: Option<String>,
    #[serde(default)]
    pub compatibility: Option<u32>,
    /// Compatibility profile hint learned/applied for this app (e.g. "photoshop")
    #[serde(default)]
    pub profile: Option<String>,
    /// Base64 data URL of the application's embedded icon
    #[serde(default)]
    pub icon_data: Option<String>,
    /// Custom command-line launch arguments (e.g. "-dx11", "-novid")
    #[serde(default)]
    pub launch_arguments: Option<String>,
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
                let obj = value.as_object_mut().ok_or("state not an object")?;
                obj.entry("applications")
                    .or_insert_with(|| serde_json::json!([]));
                obj.entry("bottles")
                    .or_insert_with(|| serde_json::json!([]));
                obj.entry("runtimes")
                    .or_insert_with(|| serde_json::json!([]));
                obj.insert("schema_version".into(), serde_json::json!(1));
            }
            1 => {
                // v2: additive fields & legacy field compatibility.
                let obj = value.as_object_mut().ok_or("state not an object")?;

                // Map legacy "apps" key to "applications"
                if let Some(apps) = obj.remove("apps") {
                    obj.entry("applications").or_insert(apps);
                }
                obj.entry("applications")
                    .or_insert_with(|| serde_json::json!([]));

                if let Some(apps) = obj.get_mut("applications").and_then(|a| a.as_array_mut()) {
                    for ap in apps.iter_mut() {
                        if let Some(o) = ap.as_object_mut() {
                            if let Some(p) = o.remove("exe_path") {
                                o.entry("executable_path").or_insert(p);
                            }
                            o.entry("category")
                                .or_insert_with(|| serde_json::json!("applications"));
                            o.entry("favorite")
                                .or_insert_with(|| serde_json::json!(false));
                            o.entry("launch_count")
                                .or_insert_with(|| serde_json::json!(0));
                            o.entry("play_time_mins")
                                .or_insert_with(|| serde_json::json!(0));
                            o.entry("last_played")
                                .or_insert_with(|| serde_json::json!(null));
                            o.entry("compatibility")
                                .or_insert_with(|| serde_json::json!(null));
                            o.entry("profile")
                                .or_insert_with(|| serde_json::json!(null));
                        }
                    }
                }

                // Migrate bottles & normalize legacy fields
                if let Some(bottles) = obj.get_mut("bottles").and_then(|b| b.as_array_mut()) {
                    for bo in bottles.iter_mut() {
                        if let Some(o) = bo.as_object_mut() {
                            if let Some(wv) = o.get("wine_version").cloned() {
                                o.entry("runtime").or_insert(wv);
                            }
                            o.entry("runtime")
                                .or_insert_with(|| serde_json::json!("Whisky-Wine (Apple GPTK)"));

                            if let Some(wv) = o.get("win_version").cloned() {
                                o.entry("windows_version").or_insert(wv);
                            }
                            o.entry("windows_version")
                                .or_insert_with(|| serde_json::json!("win10"));

                            if let Some(gb) = o.get("graphics_backend").cloned() {
                                o.entry("graphics").or_insert(gb);
                            }
                            o.entry("graphics")
                                .or_insert_with(|| serde_json::json!("automatic"));

                            o.entry("prefix_type")
                                .or_insert_with(|| serde_json::json!("gaming"));
                            o.entry("created_at")
                                .or_insert_with(|| serde_json::json!("2026-08-09T00:00:00Z"));
                            o.entry("last_used_at")
                                .or_insert_with(|| serde_json::json!(null));
                            o.entry("dxvk_enabled")
                                .or_insert_with(|| serde_json::json!(true));

                            // Convert legacy map env_vars: {"K": "V"} to environment: [["K", "V"]]
                            if let Some(env_val) = o.remove("env_vars") {
                                if let Some(map) = env_val.as_object() {
                                    let pairs: Vec<serde_json::Value> = map
                                        .iter()
                                        .map(|(k, v)| {
                                            let val_str = v.as_str().unwrap_or("");
                                            serde_json::json!([k, val_str])
                                        })
                                        .collect();
                                    o.entry("environment")
                                        .or_insert(serde_json::Value::Array(pairs));
                                }
                            }
                            o.entry("environment")
                                .or_insert_with(|| serde_json::json!([]));

                            // Normalize dll_overrides
                            if let Some(dlls) =
                                o.get_mut("dll_overrides").and_then(|d| d.as_array_mut())
                            {
                                let mut string_dlls = Vec::new();
                                for d in dlls.iter() {
                                    if let Some(s) = d.as_str() {
                                        string_dlls.push(serde_json::json!(s));
                                    } else if let Some(lib) =
                                        d.get("library").and_then(|l| l.as_str())
                                    {
                                        string_dlls.push(serde_json::json!(lib));
                                    }
                                }
                                *dlls = string_dlls;
                            }
                            o.entry("dll_overrides")
                                .or_insert_with(|| serde_json::json!([]));
                            o.entry("dependencies")
                                .or_insert_with(|| serde_json::json!([]));
                        }
                    }
                }

                // Migrate runtimes
                obj.entry("runtimes")
                    .or_insert_with(|| serde_json::json!([]));
                if let Some(runtimes) = obj.get_mut("runtimes").and_then(|r| r.as_array_mut()) {
                    for rt in runtimes.iter_mut() {
                        if let Some(o) = rt.as_object_mut() {
                            for key in ["version", "path", "url", "sha256"] {
                                o.entry(key).or_insert_with(|| serde_json::json!(""));
                            }
                            o.entry("size_bytes")
                                .or_insert_with(|| serde_json::json!(0));
                        }
                    }
                }

                obj.entry("snapshots")
                    .or_insert_with(|| serde_json::json!([]));

                // Normalize settings if object or missing
                if let Some(s) = obj.get("settings") {
                    if s.is_object() {
                        let mut pairs = Vec::new();
                        if let Some(map) = s.as_object() {
                            for (k, v) in map {
                                let v_str = match v {
                                    serde_json::Value::String(s) => s.clone(),
                                    other => other.to_string(),
                                };
                                pairs.push(serde_json::json!([k, v_str]));
                            }
                        }
                        obj.insert("settings".into(), serde_json::Value::Array(pairs));
                    }
                }
                obj.entry("settings")
                    .or_insert_with(|| serde_json::json!([["safe_mode", "off"]]));
                obj.insert("schema_version".into(), serde_json::json!(2));
            }
            2 => {
                // v3: Add msync_enabled, performance_hud, retina_mode to bottles
                let obj = value.as_object_mut().ok_or("state not an object")?;
                if let Some(bottles) = obj.get_mut("bottles").and_then(|b| b.as_array_mut()) {
                    for bo in bottles.iter_mut() {
                        if let Some(o) = bo.as_object_mut() {
                            o.entry("msync_enabled")
                                .or_insert_with(|| serde_json::json!(true));
                            o.entry("performance_hud")
                                .or_insert_with(|| serde_json::json!(false));
                            o.entry("retina_mode")
                                .or_insert_with(|| serde_json::json!(false));
                        }
                    }
                }
                obj.insert("schema_version".into(), serde_json::json!(3));
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
        assert_eq!(state.schema_version, 3);
        assert_eq!(state.bottles[0].graphics, "automatic");
        assert_eq!(state.bottles[0].dll_overrides.len(), 0);
        assert!(state.bottles[0].msync_enabled);
        assert!(!state.bottles[0].performance_hud);
        assert!(!state.bottles[0].retina_mode);
        assert_eq!(state.runtimes[0].version, "");
        assert_eq!(state.snapshots.len(), 0);
    }

    #[test]
    fn v2_json_migrates_to_v3() {
        let raw = r#"{
            "schema_version": 2,
            "bottles": [{
                "id": "b1", "name": "Office", "prefix_type": "productivity",
                "runtime": "Wine Stable", "windows_version": "win10",
                "graphics": "wined3d", "dxvk_enabled": false,
                "path": "/data/bottles/b1", "created_at": "2026-08-12T00:00:00Z", "last_used_at": null
            }],
            "applications": [],
            "runtimes": [],
            "snapshots": [],
            "settings": []
        }"#;
        let state = AppState::from_raw(raw).unwrap();
        assert_eq!(state.schema_version, 3);
        assert!(state.bottles[0].msync_enabled);
        assert!(!state.bottles[0].performance_hud);
        assert!(!state.bottles[0].retina_mode);
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

    #[test]
    fn legacy_disk_json_migrates() {
        let raw = r#"{
            "schema_version": 1,
            "bottles": [
                {
                    "id": "bottle-2ff1dd5a",
                    "name": "Steam",
                    "prefix_type": "gaming",
                    "wine_version": "Proton GE 9.0",
                    "dxvk_enabled": true,
                    "moltenvk_enabled": true,
                    "win_version": "win10",
                    "graphics_backend": "auto",
                    "env_vars": {
                        "DXVK_HUD": "fps"
                    },
                    "dll_overrides": [
                        { "library": "d3d11", "override_type": "native,builtin" }
                    ],
                    "path": "/data/bottle-2ff1dd5a",
                    "created_at": "2026-08-09"
                }
            ],
            "apps": [],
            "runtimes": [],
            "settings": { "wine_binary_path": "", "sandbox_enabled": true }
        }"#;
        let state = AppState::from_raw(raw).unwrap();
        assert_eq!(state.schema_version, CURRENT_SCHEMA_VERSION);
        assert_eq!(state.bottles.len(), 1);
        assert_eq!(state.bottles[0].name, "Steam");
        assert_eq!(state.bottles[0].runtime, "Proton GE 9.0");
        assert_eq!(state.bottles[0].windows_version, "win10");
        assert_eq!(state.bottles[0].environment[0].0, "DXVK_HUD");
        assert_eq!(state.bottles[0].dll_overrides, vec!["d3d11"]);
        assert_eq!(state.applications.len(), 0);
    }
}

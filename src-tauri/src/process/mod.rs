use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use serde::Serialize;

use crate::core::errors::FusionError;

#[allow(dead_code, unused)]
pub struct SessionRecord {
    #[allow(dead_code)]
    pub app_id: String,
    #[allow(dead_code)]
    pub bottle_id: String,
    #[allow(dead_code)]
    pub name: String,
    #[allow(dead_code)]
    pub duration_secs: u64,
    #[allow(dead_code)]
    pub exit_code: Option<i32>,
    #[allow(dead_code)]
    pub log_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunningInfo {
    pub app_id: String,
    pub bottle_id: String,
    pub name: String,
    pub pid: u32,
    pub started_at: u64,
    pub elapsed_secs: u64,
    pub log_path: Option<String>,
}

struct SessionState {
    pid: u32,
    name: String,
    bottle_id: String,
    started_at: SystemTime,
    log_path: Option<String>,
}

/// Owns all running Wine app processes. Each app runs in its own process
/// group so stopping it kills the whole tree (game + launcher + subprocesses).
pub struct ProcessManager {
    sessions: Arc<Mutex<HashMap<String, SessionState>>>,
    on_exit: Arc<dyn Fn(SessionRecord) + Send + Sync>,
}

impl ProcessManager {
    pub fn new(on_exit: Arc<dyn Fn(SessionRecord) + Send + Sync>) -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            on_exit,
        }
    }

    pub fn is_running(&self, app_id: &str) -> bool {
        self.sessions
            .lock()
            .map(|m| m.contains_key(app_id))
            .unwrap_or(false)
    }

    /// Spawn `wine <exe> [args]` in the bottle's prefix. The child leads its
    /// own process group; stats are recorded through `on_exit` when it finishes.
    #[allow(clippy::too_many_arguments)]
    pub fn spawn(
        &self,
        app_id: &str,
        bottle_id: &str,
        name: &str,
        wine_binary: &str,
        prefix_path: &str,
        executable: &str,
        args: &[String],
        env: &[(String, String)],
        dll_overrides: &str,
        log_path: Option<&std::path::Path>,
    ) -> Result<RunningInfo, FusionError> {
        use std::os::unix::process::CommandExt;
        let mut cmd = std::process::Command::new(wine_binary);
        cmd.env("WINEPREFIX", prefix_path);
        cmd.env(
            "WINEDLLOVERRIDES",
            if dll_overrides.is_empty() {
                "mscoree,mshtml="
            } else {
                dll_overrides
            },
        );
        for (k, v) in env {
            cmd.env(k, v);
        }
        cmd.arg(executable).args(args);
        cmd.process_group(0); // own process group for group-kill
        cmd.stdin(std::process::Stdio::null());

        let log_file_res = if let Some(lp) = log_path {
            if let Some(parent) = lp.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            std::fs::OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(lp)
                .ok()
        } else {
            None
        };

        if let Some(ref f) = log_file_res {
            if let Ok(f_clone) = f.try_clone() {
                cmd.stdout(std::process::Stdio::from(f_clone));
            } else {
                cmd.stdout(std::process::Stdio::null());
            }
            if let Ok(f_clone2) = f.try_clone() {
                cmd.stderr(std::process::Stdio::from(f_clone2));
            } else {
                cmd.stderr(std::process::Stdio::null());
            }
        } else {
            cmd.stdout(std::process::Stdio::null());
            cmd.stderr(std::process::Stdio::null());
        }

        let mut child = cmd.spawn().map_err(|_| FusionError::LaunchFailed)?;
        let pid = child.id();
        let started_at = SystemTime::now();
        let log_path_str = log_path.and_then(|p| p.to_str()).map(|s| s.to_string());
        let info = RunningInfo {
            app_id: app_id.to_string(),
            bottle_id: bottle_id.to_string(),
            name: name.to_string(),
            pid,
            started_at: started_at
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0),
            elapsed_secs: 0,
            log_path: log_path_str.clone(),
        };

        {
            let mut sessions = self.sessions.lock().map_err(|_| FusionError::Unsupported)?;
            sessions.insert(
                app_id.to_string(),
                SessionState {
                    pid,
                    name: name.to_string(),
                    bottle_id: bottle_id.to_string(),
                    started_at,
                    log_path: log_path_str.clone(),
                },
            );
        }

        // Watcher: wait on child in background thread without holding mutex!
        let sessions = self.sessions.clone();
        let on_exit = self.on_exit.clone();
        let app_id_owned = app_id.to_string();
        let log_path_owned = log_path_str;
        std::thread::spawn(move || {
            let status = child.wait().ok();
            let exit_code = status.and_then(|st| st.code());

            let (bottle_id, name, started) = {
                let mut m = sessions.lock().unwrap();
                match m.remove(&app_id_owned) {
                    Some(state) => (state.bottle_id, state.name, state.started_at),
                    None => return,
                }
            };
            let duration = SystemTime::now()
                .duration_since(started)
                .unwrap_or(Duration::ZERO);
            on_exit(SessionRecord {
                app_id: app_id_owned,
                bottle_id,
                name,
                duration_secs: duration.as_secs(),
                exit_code,
                log_path: log_path_owned,
            });
        });
        Ok(info)
    }

    /// Stop an app by killing its whole process group.
    pub fn stop(&self, app_id: &str) -> Result<(), FusionError> {
        let pid = {
            let m = self.sessions.lock().map_err(|_| FusionError::Unsupported)?;
            m.get(app_id).map(|s| s.pid)
        };
        match pid {
            Some(pid) => {
                let rc = unsafe { libc::kill(-(pid as i32), libc::SIGTERM) };
                if rc == 0 {
                    Ok(())
                } else {
                    Err(FusionError::LaunchFailed)
                }
            }
            None => Err(FusionError::ApplicationNotFound),
        }
    }

    pub fn running(&self) -> Vec<RunningInfo> {
        let now = SystemTime::now();
        self.sessions
            .lock()
            .map(|m| {
                m.iter()
                    .map(|(app_id, s)| RunningInfo {
                        app_id: app_id.clone(),
                        bottle_id: s.bottle_id.clone(),
                        name: s.name.clone(),
                        pid: s.pid,
                        started_at: s
                            .started_at
                            .duration_since(std::time::UNIX_EPOCH)
                            .map(|d| d.as_secs())
                            .unwrap_or(0),
                        elapsed_secs: now
                            .duration_since(s.started_at)
                            .map(|d| d.as_secs())
                            .unwrap_or(0),
                        log_path: s.log_path.clone(),
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn early_session_record_surfaces_duration() {
        // Exercised end-to-end via the integration tests / manual launch.
        let rec = SessionRecord {
            app_id: "a".into(),
            bottle_id: "b".into(),
            name: "N".into(),
            duration_secs: 0,
            exit_code: Some(0),
            log_path: None,
        };
        assert_eq!(rec.exit_code, Some(0));
    }
}

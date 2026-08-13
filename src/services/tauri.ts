import { invoke } from "@tauri-apps/api/core";

/** Structured backend errors (PRD §51) — `{ code, message, action? }`. */
export interface FusionErrorPayload {
  code: string;
  message: string;
  action?: string;
}

export interface SystemInfo {
  app_version: string;
  arch: string;
  os: string;
  engines: string[];
}

export interface RuntimeStatus {
  name: string;
  version: string;
}

export interface Bottle {
  id: string;
  name: string;
  prefix_type: string;
  runtime: string;
  windows_version: string;
  graphics: string;
  dxvk_enabled: boolean;
  path: string;
  created_at: string;
  last_used_at: string | null;
  environment: Record<string, string> | [string, string][];
  dll_overrides: string[];
  dependencies: string[];
}

export interface Application {
  id: string;
  bottle_id: string;
  name: string;
  executable_path: string;
  category: string;
  favorite: boolean;
  launch_count: number;
  play_time_mins: number;
  last_played: string | null;
  compatibility?: number;
  profile?: string;
}

export interface Runtime {
  id: string;
  name: string;
  category: string;
  downloaded: boolean;
  version: string;
  path: string;
  url?: string;
  sha256?: string;
  size_bytes?: number;
  note?: string;
}

export interface Snapshot {
  id: string;
  bottle_id: string;
  name: string;
  path: string;
  size_bytes: number;
  created_at: string;
}

export interface AppState {
  schema_version: number;
  applications: Application[];
  bottles: Bottle[];
  runtimes: Runtime[];
  snapshots: Snapshot[];
  settings: [string, string][];
}

export interface BottleTemplate {
  type: string;
  label: string;
  description: string;
  windows_version: string;
  graphics: string;
  dxvk_enabled: boolean;
  dependencies: string[];
}

export interface InstallerAnalysis {
  path: string;
  file_name: string;
  extension: string;
  size_bytes: number;
  arch: string;
  suggested_name: string;
  is_windows_installer: boolean;
}

export interface DiscoveredExe {
  name: string;
  rel_path: string;
  category: string;
}

export interface Job {
  id: string;
  title: string;
  status: "Running" | "Done" | "Failed" | string;
  message?: string;
}

export interface RunningInfo {
  app_id: string;
  bottle_id: string;
  name: string;
  pid: number;
  started_at: number;
  elapsed_secs: number;
}

export interface Recommendation {
  profile: string;
  runtime_hint: string;
  graphics: string;
  windows_version: string;
  dependencies: string[];
  launch_arguments: string[];
  compatibility: number;
  notes: string[];
}

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  detail: string;
  suggested_fix: string | null;
}

export const getSystemInfo = () => invoke<SystemInfo>("get_system_info");
export const getState = () => invoke<AppState>("get_state");
export const probeRuntime = (engine: string) => invoke<RuntimeStatus>("probe_runtime", { engine });

export const getTemplates = () => invoke<BottleTemplate[]>("get_templates");
export const getRuntimes = () => invoke<Runtime[]>("get_runtimes");

export const createBottle = (name: string, templateType: string) =>
  invoke<Bottle>("create_bottle", { name, templateType });
export const deleteBottle = (bottleId: string) => invoke<void>("delete_bottle", { bottleId });
export const cloneBottle = (bottleId: string, newName: string) =>
  invoke<Bottle>("clone_bottle", { bottleId, newName });
export const updateBottle = (
  bottleId: string,
  params: {
    windows_version?: string;
    graphics?: string;
    dxvk_enabled?: boolean;
    environment?: [string, string][];
    dll_overrides?: string[];
  }
) => invoke<void>("update_bottle", { bottleId, ...params });
export const repairBottle = (bottleId: string) => invoke<string>("repair_bottle", { bottleId });

export const analyzeInstaller = (path: string) => invoke<InstallerAnalysis>("analyze_installer", { path });
export const scanBottle = (bottleId: string) => invoke<DiscoveredExe[]>("scan_bottle", { bottleId });
export const registerApplication = (
  bottleId: string,
  name: string,
  executablePath: string,
  category: string
) => invoke<Application>("register_application", { bottleId, name, executablePath, category });

export const runInstaller = (installerPath: string, bottleId: string) =>
  invoke<string>("run_installer", { installerPath, bottleId });
export const listJobs = () => invoke<Job[]>("list_jobs");

export const launchApplication = (appId: string) => invoke<RunningInfo>("launch_application", { appId });
export const stopApplication = (appId: string) => invoke<void>("stop_application", { appId });
export const listRunning = () => invoke<RunningInfo[]>("list_running");
export const toggleFavorite = (appId: string) => invoke<void>("toggle_favorite", { appId });

export const getRecommendation = (name: string) => invoke<Recommendation>("get_recommendation", { name });
export const runDiagnostics = (appId: string) => invoke<DiagnosticCheck[]>("run_diagnostics", { appId });
export const applyFix = (fixId: string, appId: string) => invoke<string>("apply_fix", { fixId, appId });

export const createSnapshot = (bottleId: string, name: string) =>
  invoke<Snapshot>("create_snapshot", { bottleId, name });
export const restoreSnapshot = (snapshotId: string) => invoke<void>("restore_snapshot", { snapshotId });
export const deleteSnapshot = (snapshotId: string) => invoke<void>("delete_snapshot", { snapshotId });

export const importRuntime = (name: string, archivePath: string) =>
  invoke<Runtime>("import_runtime", { name, archivePath });
export const removeRuntime = (runtimeId: string) => invoke<void>("remove_runtime", { runtimeId });
export const setSafeMode = (enabled: boolean) => invoke<void>("set_safe_mode", { enabled });
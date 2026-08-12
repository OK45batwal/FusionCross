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
  path: string;
  created_at: string;
  last_used_at: string | null;
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
}

export interface Runtime {
  id: string;
  name: string;
  category: string;
  downloaded: boolean;
}

export interface AppState {
  schema_version: number;
  applications: Application[];
  bottles: Bottle[];
  runtimes: Runtime[];
}

export const getSystemInfo = () => invoke<SystemInfo>("get_system_info");
export const getState = () => invoke<AppState>("get_state");
export const probeRuntime = (engine: string) =>
  invoke<RuntimeStatus>("probe_runtime", { engine });
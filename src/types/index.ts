export interface DllOverride {
  library: string;
  override_type: string;
}

export interface RegistryKey {
  path: string;
  key: string;
  value: string;
  value_type: string;
}

export interface Bottle {
  id: string;
  name: string;
  prefix_type: 'gaming' | 'productivity' | 'legacy' | 'dxvk-optimized' | 'lightweight' | string;
  wine_version: string;
  dxvk_enabled: boolean;
  moltenvk_enabled: boolean;
  win_version: string;
  env_vars: Record<string, string>;
  dll_overrides: DllOverride[];
  registry_keys: RegistryKey[];
  size_bytes: number;
  path: string;
  created_at: string;
}

export interface AppConfig {
  id: string;
  name: string;
  exe_path: string;
  arguments: string;
  icon: string;
  category: string;
  tags: string[];
  bottle_id: string;
  last_played: string | null;
  play_time_mins: number;
  favorite: boolean;
}

export interface Runtime {
  id: string;
  name: string;
  category: 'wine' | 'proton' | 'dxvk' | 'moltenvk' | string;
  version: string;
  size_bytes: number;
  downloaded: boolean;
  path: string;
}

export interface SysMetrics {
  cpu_usage: number;
  ram_usage_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_free_gb: number;
  gpu_usage: number;
  fps: number;
  shader_compilation_percent: number;
}

export interface SoftwareRecipe {
  id: string;
  name: string;
  category: 'Games' | 'Productivity' | 'Utilities';
  description: string;
  recommended_prefix: string;
  rating: number;
  icon: string;
  popular: boolean;
}


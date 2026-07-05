import { useState } from 'react';
import { AppConfig, InstallResult } from '../types';

const isTauri = () =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export function useApps(setLogs: React.Dispatch<React.SetStateAction<string[]>>) {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);

  const registerApp = async (name: string, exe: string, args: string, bottleId: string, cat: string, tags: string[]) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const newA = await invoke<AppConfig>('register_app', { name, exePath: exe, arguments: args, bottleId, category: cat, tags });
      setApps((prev) => [...prev, newA]);
    } else {
      setApps((prev) => [
        ...prev,
        {
          id: `app-${Math.floor(Math.random() * 1000)}`,
          name,
          exe_path: exe,
          arguments: args,
          icon: name.toLowerCase().includes('office') ? 'office' : 'generic',
          category: cat,
          tags,
          bottle_id: bottleId,
          last_played: null,
          play_time_mins: 0,
          favorite: false,
        },
      ]);
    }
  };

  const toggleFavorite = async (id: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const updated = await invoke<AppConfig>('toggle_favorite', { id });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } else {
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)));
    }
  };

  const launchApp = async (id: string, appsList: AppConfig[]) => {
    setActiveAppId(id);
    setLogs([]);
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('run_app', { id });
      } catch (err) {
        console.error(err);
      }
    } else {
      const selected = appsList.find((a) => a.id === id);
      const name = selected ? selected.name : 'App';
      const mockLogs = [
        `[Wine] Starting bottle execution for prefix 'bottle-gaming'`,
        `[Wine] Pre-initializing directx components using DXVK translation...`,
        `[Wine] Setting WINEPREFIX environment variables to sandbox prefix.`,
        `[Wine] CPU Core mapping confirmed. Rosetta 2 x86 thread translator active.`,
        `[Wine] MoltenVK: Vulkan instance extensions configured. Vulkan-to-Metal translation active.`,
        `[Wine] [${name}] Main game executable initialized. Streaming application logs...`,
        `[Wine] [${name}] Thread allocation complete. Game audio hooked into CoreAudio device.`,
      ];
      let index = 0;
      const logInterval = setInterval(() => {
        if (index < mockLogs.length) {
          setLogs((prev) => [...prev, mockLogs[index]]);
          index++;
        } else {
          clearInterval(logInterval);
        }
      }, 500);
    }
  };

  const stopApp = async () => {
    setActiveAppId(null);
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_active_app');
    }
  };

  const runCustomExe = async (bottleId: string, exePath: string, args: string, bottlePath?: string) => {
    setLogs([]);
    if (!bottlePath) {
      setLogs((prev) => [...prev, `[FusionCross:Error] Bottle not found.`]);
      return;
    }

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        setLogs((prev) => [...prev, `[FusionCross] Preparing executable wrapper...`]);
        setLogs((prev) => [...prev, `[FusionCross] WINEPREFIX: ${bottlePath}`]);
        setLogs((prev) => [...prev, `[FusionCross] Executing: ${exePath} ${args}`]);
        await invoke('execute_windows_binary', { prefixPath: bottlePath, exePath, arguments: args });
      } catch (err: any) {
        setLogs((prev) => [...prev, `[FusionCross:Error] Execution failed: ${err}`]);
      }
    } else {
      setLogs((prev) => [...prev, `[Wine] Initializing Custom Executable Execution...`]);
      setLogs((prev) => [...prev, `[Wine] Executable Path: ${exePath}`]);
      setLogs((prev) => [...prev, `[Wine] Environment: WINEPREFIX=${bottlePath}`]);
      setLogs((prev) => [...prev, `[Wine] Output: Audio output initialized.`]);
      setLogs((prev) => [...prev, `[Wine] Output: Execution completed successfully.`]);
    }
  };

  const exportLogs = async (logs: string[], path: string): Promise<string> => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('export_logs', { logs, exportPath: path });
    } else {
      return `Mock logs exported successfully to ${path}`;
    }
  };

  return {
    apps,
    setApps,
    activeAppId,
    setActiveAppId,
    registerApp,
    toggleFavorite,
    launchApp,
    stopApp,
    runCustomExe,
    exportLogs,
  };
}

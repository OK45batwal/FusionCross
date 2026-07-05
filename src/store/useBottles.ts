import { useState } from 'react';
import { Bottle } from '../types';

const isTauri = () =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export function useBottles() {
  const [bottles, setBottles] = useState<Bottle[]>([]);

  const createBottle = async (name: string, type: string, wineVersion: string): Promise<Bottle> => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const b = await invoke<Bottle>('create_bottle', { name, prefixType: type, wineVersion });
      setBottles((prev) => [...prev, b]);
      return b;
    } else {
      const newB: Bottle = {
        id: `bottle-${Math.floor(Math.random() * 1000)}`,
        name,
        prefix_type: type,
        wine_version: wineVersion,
        dxvk_enabled: true,
        moltenvk_enabled: true,
        win_version: 'win10',
        env_vars: { DXVK_HUD: 'fps', WINEESYNC: '1' },
        dll_overrides: [{ library: 'd3d11', override_type: 'native,builtin' }],
        registry_keys: [],
        size_bytes: 450000000,
        path: `~/Library/Application Support/FusionCross/bottles/${name.toLowerCase().replace(/\s+/g, '-')}`,
        created_at: new Date().toISOString().split('T')[0],
      };
      setBottles((prev) => [...prev, newB]);
      return newB;
    }
  };

  const removeBottle = async (id: string, onRemoveApps: (bottleId: string) => void) => {
    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('delete_bottle', { id });
      } catch (err) {
        console.warn('[FusionCross] Backend delete_bottle failed (cleaning up UI state anyway):', err);
      }
    }
    setBottles((prev) => prev.filter((b) => b.id !== id));
    onRemoveApps(id);
  };

  const duplicateBottle = async (id: string, name: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const cloned = await invoke<Bottle>('clone_bottle', { id, targetName: name });
      setBottles((prev) => [...prev, cloned]);
    } else {
      const src = bottles.find((b) => b.id === id);
      if (src) {
        setBottles((prev) => [
          ...prev,
          { ...src, id: `bottle-${Math.floor(Math.random() * 1000)}`, name, created_at: new Date().toISOString().split('T')[0] },
        ]);
      }
    }
  };

  const updateBottle = async (updatedBottle: Bottle) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_bottle_settings', {
        id: updatedBottle.id,
        winVersion: updatedBottle.win_version,
        dxvkEnabled: updatedBottle.dxvk_enabled,
        moltenvkEnabled: updatedBottle.moltenvk_enabled,
        dllOverrides: updatedBottle.dll_overrides,
        envVars: updatedBottle.env_vars,
        registryKeys: updatedBottle.registry_keys,
      });
    }
    setBottles((prev) => prev.map((b) => (b.id === updatedBottle.id ? updatedBottle : b)));
  };

  const openPrefixInFinder = async (prefixPath: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('open_prefix_in_finder', { prefixPath });
      } catch (err) {
        console.error('Failed to open prefix in Finder:', err);
      }
    } else {
      console.log('Open in Finder (browser mode):', prefixPath);
    }
  };

  const resetSandbox = async (bottleId: string, prefixPath: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('reset_sandbox', { bottleId, prefixPath });
      } catch (err) {
        console.error('Failed to reset sandbox:', err);
      }
    } else {
      console.log('Reset sandbox (browser mode):', bottleId);
    }
  };

  const installDxvk = async (bottleId: string, version: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('install_dxvk', { bottleId, version });
        const b = await invoke<Bottle[]>('list_bottles');
        setBottles(b);
      } catch (err) {
        console.error('Failed to install DXVK graphics engine:', err);
      }
    } else {
      setBottles((prev) => prev.map((b) => (b.id === bottleId ? { ...b, dxvk_enabled: true } : b)));
    }
  };

  const backupBottle = async (bottleId: string, backupPath: string): Promise<string> => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('backup_bottle', { bottleId, backupPath });
    } else {
      return `Mock backup completed successfully at ${backupPath}`;
    }
  };

  const scanApps = async (bottleId: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('scan_apps', { bottleId });
    } else {
      return [
        { name: 'Steam Client Launcher', path: 'C:\\Program Files (x86)\\Steam\\Steam.exe', size_bytes: 84000000 },
        { name: 'Microsoft Excel 2016', path: 'C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE', size_bytes: 42000000 },
        { name: 'Winamp Classic', path: 'C:\\Program Files\\Winamp\\winamp.exe', size_bytes: 14000000 },
      ];
    }
  };

  const installDependencies = async (bottleId: string, dependency: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        await invoke('install_dependencies', { bottleId, dependency });
      } catch (err) {
        console.error('Failed to install dependency via winetricks:', err);
      }
    }
  };

  return {
    bottles,
    setBottles,
    createBottle,
    removeBottle,
    duplicateBottle,
    updateBottle,
    openPrefixInFinder,
    resetSandbox,
    installDxvk,
    backupBottle,
    scanApps,
    installDependencies,
  };
}

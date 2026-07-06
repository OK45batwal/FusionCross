import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SysMetrics, RosettaStatus, AppConfig, SoftwareRecipe, Bottle, Runtime } from '../types';
import { useBottles } from './useBottles';
import { useApps } from './useApps';
import { useRuntimes } from './useRuntimes';
import { useRecipes } from './useRecipes';
import { Notification } from '../components/Notifications';

// ======================================================
// CONTEXT TYPE
// ======================================================

interface AppContextType {
  bottles: Bottle[];
  apps: AppConfig[];
  runtimes: Runtime[];
  recipes: SoftwareRecipe[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAppId: string | null;
  metrics: SysMetrics;
  logs: string[];
  setLogs: React.Dispatch<React.SetStateAction<string[]>>;
  clearLogs: () => void;
  downloadProgress: Record<string, number>;
  onboarded: boolean;
  setOnboarded: (val: boolean) => Promise<void> | void;
  createBottle: (name: string, type: string, wineVersion: string) => Promise<Bottle>;
  removeBottle: (id: string) => Promise<void>;
  duplicateBottle: (id: string, name: string) => Promise<void>;
  updateBottle: (bottle: Bottle) => Promise<void>;
  registerApp: (name: string, exe: string, args: string, bottleId: string, cat: string, tags: string[]) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  launchApp: (id: string) => Promise<void>;
  stopApp: () => Promise<void>;
  downloadRuntime: (id: string) => Promise<void>;
  installRecipe: (recipeId: string, bottleName: string, bottleType: string, wineVersion: string, customAppName?: string, customExePath?: string, targetBottleId?: string) => Promise<void>;
  runCustomExe: (bottleId: string, exePath: string, args: string) => Promise<void>;
  addCustomRecipe: (recipe: Omit<SoftwareRecipe, 'id'>) => void;
  openPrefixInFinder: (prefixPath: string) => Promise<void>;
  resetSandbox: (bottleId: string, prefixPath: string) => Promise<void>;
  showWizard: boolean;
  setShowWizard: (val: boolean) => void;
  wizardRecipeId: string | 'custom' | null;
  setWizardRecipeId: (val: string | 'custom' | null) => void;
  rosettaDiagnostics: RosettaStatus;
  fetchRosettaStatus: () => Promise<void>;
  installDependencies: (bottleId: string, dependency: string) => Promise<void>;
  installDxvk: (bottleId: string, version: string) => Promise<void>;
  backupBottle: (bottleId: string, backupPath: string) => Promise<string>;
  scanApps: (bottleId: string) => Promise<any>;
  exportLogs: (logs: string[], path: string) => Promise<string>;
  notifications: Notification[];
  notify: (message: string, type?: Notification['type']) => void;
  dismissNotification: (id: string) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ======================================================
// HELPERS
// ======================================================

const isTauri = () =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

// ======================================================
// PROVIDER
// ======================================================

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [onboarded, setOnboardedState] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [wizardRecipeId, setWizardRecipeId] = useState<string | 'custom' | null>(null);
  const [metrics, setMetrics] = useState<SysMetrics>({
    cpu_usage: 0, ram_usage_percent: 0, ram_used_gb: 0, ram_total_gb: 16,
    disk_free_gb: 150, gpu_usage: 0, fps: 0, shader_compilation_percent: 0, active_pid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [rosettaDiagnostics, setRosettaDiagnostics] = useState<RosettaStatus>({
    is_apple_silicon: true, is_translated: true, rosetta_installed: true,
    wine_installed: true, cpu_brand: 'Apple M-Series Silicon (ARM64)',
  });

  // Domain hooks
  const {
    bottles, setBottles, createBottle: _createBottle, removeBottle: _removeBottle,
    duplicateBottle: _duplicateBottle, updateBottle: _updateBottle,
    openPrefixInFinder, resetSandbox, installDxvk, backupBottle, scanApps, installDependencies,
  } = useBottles();

  const {
    apps, setApps, activeAppId, setActiveAppId,
    registerApp: _registerApp, toggleFavorite, launchApp: _launchApp, stopApp,
    runCustomExe: _runCustomExe, exportLogs,
  } = useApps(setLogs);

  const {
    runtimes, setRuntimes, downloadProgress, setDownloadProgress, downloadRuntime, runtimeBrowserFallback,
  } = useRuntimes();

  const {
    recipes, installRecipe, addCustomRecipe,
  } = useRecipes(bottles, _createBottle, _registerApp, setLogs, setDownloadProgress);

  // Wrap bottle/app ops that need cross-domain cleanup
  const removeBottle = async (id: string) => {
    await _removeBottle(id, (bottleId: string) => {
      setApps((prev) => prev.filter((a) => a.bottle_id !== bottleId));
    });
  };

  const launchApp = async (id: string) => {
    await _launchApp(id, apps);
    setApps((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, last_played: new Date().toISOString(), launch_count: a.launch_count + 1 }
          : a,
      ),
    );
  };

  const runCustomExe = async (bottleId: string, exePath: string, args: string) => {
    const bottle = bottles.find((b) => b.id === bottleId);
    await _runCustomExe(bottleId, exePath, args, bottle?.path);
  };

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notify = useCallback((message: string, type: Notification['type'] = 'error') => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setNotifications((prev) => [...prev, { id, message, type }]);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // System state mutations
  const clearLogs = () => setLogs([]);

  const setOnboarded = async (val: boolean) => {
    setOnboardedState(val);
    if (isTauri() && val) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('complete_onboarding');
      } catch (err) {
        console.error('Failed to persist onboarding state:', err);
      }
    }
  };

  const fetchRosettaStatus = async () => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const res = await invoke<RosettaStatus>('check_rosetta_status');
        setRosettaDiagnostics(res);
      } catch (err) {
        console.error('Failed to query Rosetta status:', err);
      }
    }
  };

  // ======================================================
  // SIDE EFFECTS
  // ======================================================

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (isTauri()) {
          const { invoke } = await import('@tauri-apps/api/core');
          const session = await invoke<any>('get_session');
          const b = await invoke<Bottle[]>('list_bottles');
          const a = await invoke<AppConfig[]>('list_apps');
          const r = await invoke<Runtime[]>('list_runtimes');
          setOnboardedState(session.onboarded);
          setBottles(b);
          setApps(a);
          setRuntimes(r);
          await fetchRosettaStatus();
        } else {
          setOnboardedState(false);
          setBottles([]);
          setApps([]);
          runtimeBrowserFallback();
        }
      } catch (err) {
        console.error('Failed loading data:', err);
        notify('Failed to load initial data. Check backend connection.', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Tauri event listeners
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('wine-log-stream', (event) => {
          setLogs((prev) => [...prev.slice(-149), event.payload]);
        });
        listen<{ id: string; progress: number }>('download-progress', (event) => {
          const { id, progress } = event.payload;
          setDownloadProgress((prev) => ({ ...prev, [id]: progress }));
          if (progress >= 100) {
            setRuntimes((prev) => prev.map((r) => (r.id === id ? { ...r, downloaded: true } : r)));
          }
        });
        listen('app-process-exited', () => {
          setActiveAppId(null);
        });
        listen<string>('runtime-downloaded', async (event) => {
          const runtimeId = event.payload;
          setRuntimes((prev) => prev.map((r) => (r.id === runtimeId ? { ...r, downloaded: true } : r)));
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('mark_runtime_downloaded', { id: runtimeId });
          } catch (err) {
            console.error('Failed to persist runtime download state:', err);
          }
        });
      });
    }
  }, []);

  // Metrics polling
  useEffect(() => {
    let interval: any;
    const fetchMetrics = async () => {
      if (isTauri()) {
        const { invoke } = await import('@tauri-apps/api/core');
        try {
          const sys = await invoke<SysMetrics>('get_system_metrics');
          setMetrics(sys);
        } catch (err) {
          console.error(err);
        }
      } else {
        setMetrics((prev) => {
          const isAppRunning = activeAppId !== null;
          return {
            cpu_usage: parseFloat((isAppRunning ? Math.random() * 15 + 40 : Math.random() * 2 + 1.5).toFixed(1)),
            ram_usage_percent: 58.4,
            ram_used_gb: 9.34,
            ram_total_gb: 16.0,
            disk_free_gb: 192.4,
            gpu_usage: parseFloat((isAppRunning ? Math.random() * 20 + 55 : Math.random() * 1.5 + 0.5).toFixed(1)),
            fps: isAppRunning ? Math.floor(Math.random() * 15 + 80) : 0,
            shader_compilation_percent: isAppRunning ? Math.min(100, Math.floor(prev.shader_compilation_percent + Math.random() * 2)) : 0,
            active_pid: prev.active_pid,
          };
        });
      }
    };
    interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, [activeAppId]);

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <AppContext.Provider
      value={{
        bottles,
        apps,
        runtimes,
        recipes,
        activeTab,
        setActiveTab,
        activeAppId,
        metrics,
        logs,
        setLogs,
        clearLogs,
        downloadProgress,
        onboarded,
        setOnboarded,
        createBottle: _createBottle,
        removeBottle,
        duplicateBottle: _duplicateBottle,
        updateBottle: _updateBottle,
        registerApp: _registerApp,
        toggleFavorite,
        launchApp,
        stopApp,
        downloadRuntime,
        installRecipe,
        runCustomExe,
        addCustomRecipe,
        openPrefixInFinder,
        resetSandbox,
        showWizard,
        setShowWizard,
        wizardRecipeId,
        setWizardRecipeId,
        rosettaDiagnostics,
        fetchRosettaStatus,
        installDependencies,
        installDxvk,
        backupBottle,
        scanApps,
        exportLogs,
        notifications,
        notify,
        dismissNotification,
        loading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Bottle, AppConfig, Runtime, SysMetrics, SoftwareRecipe } from '../types';

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
  clearLogs: () => void;
  downloadProgress: Record<string, number>;
  onboarded: boolean;
  setOnboarded: (val: boolean) => void;
  createBottle: (name: string, type: string, wineVersion: string) => Promise<void>;
  removeBottle: (id: string) => Promise<void>;
  duplicateBottle: (id: string, name: string) => Promise<void>;
  updateBottle: (bottle: Bottle) => Promise<void>;
  registerApp: (name: string, exe: string, args: string, bottleId: string, cat: string, tags: string[]) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  launchApp: (id: string) => Promise<void>;
  stopApp: () => Promise<void>;
  downloadRuntime: (id: string) => Promise<void>;
  installRecipe: (recipeId: string, bottleName: string, bottleType: string, wineVersion: string) => Promise<void>;
  runCustomExe: (bottleId: string, exePath: string, args: string) => Promise<void>;
  addCustomRecipe: (recipe: Omit<SoftwareRecipe, 'id'>) => void;
  openPrefixInFinder: (prefixPath: string) => Promise<void>;
  resetSandbox: (bottleId: string, prefixPath: string) => Promise<void>;
  showWizard: boolean;
  setShowWizard: (val: boolean) => void;
  wizardRecipeId: string | 'custom' | null;
  setWizardRecipeId: (val: string | 'custom' | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to check if running inside Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
};

const DEFAULT_RECIPES: SoftwareRecipe[] = [
  {
    id: 'steam',
    name: 'Steam Launcher',
    category: 'Games',
    description: 'Valve\'s digital storefront and hub for thousands of PC games. Optimized with DXVK rendering.',
    recommended_prefix: 'gaming',
    rating: 4.8,
    icon: 'steam',
    popular: true
  },
  {
    id: 'office',
    name: 'Microsoft Office Suite',
    category: 'Productivity',
    description: 'Includes Word, Excel, and PowerPoint. Optimized with standard windows configurations and pre-loaded fonts.',
    recommended_prefix: 'productivity',
    rating: 4.2,
    icon: 'office',
    popular: true
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop CC',
    category: 'Productivity',
    description: 'Premier graphic design suite. Requires legacy DLL compatibility and custom registry patches.',
    recommended_prefix: 'dxvk-optimized',
    rating: 4.5,
    icon: 'photoshop',
    popular: true
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk 2077',
    category: 'Games',
    description: 'Next-gen action RPG. High-performance gaming template pre-configured with MoltenVK to Metal translation.',
    recommended_prefix: 'gaming',
    rating: 4.9,
    icon: 'cyberpunk',
    popular: true
  },
  {
    id: 'flstudio',
    name: 'FL Studio 21',
    category: 'Productivity',
    description: 'Professional digital audio workstation (DAW). Optimized with CoreAudio ASIO wrappers for low-latency recording.',
    recommended_prefix: 'productivity',
    rating: 4.7,
    icon: 'generic',
    popular: true
  },
  {
    id: 'discord',
    name: 'Discord (Voice & Chat)',
    category: 'Utilities',
    description: 'Popular vocal and text chat client. Optimized with lightweight thread allocations and low-latency system overrides.',
    recommended_prefix: 'lightweight',
    rating: 4.4,
    icon: 'generic',
    popular: true
  },
  {
    id: 'witcher3',
    name: 'The Witcher 3: Wild Hunt',
    category: 'Games',
    description: 'Fantasy action-RPG masterpiece. Includes DXVK v2.3 shaders pre-caching and customized retina scaling settings.',
    recommended_prefix: 'gaming',
    rating: 4.9,
    icon: 'witcher',
    popular: false
  },
  {
    id: 'gtav',
    name: 'Grand Theft Auto V',
    category: 'Games',
    description: 'Open-world crime epic. Performance profile includes MoltenVK translation and low CPU-overhead environment flags.',
    recommended_prefix: 'gaming',
    rating: 4.8,
    icon: 'generic',
    popular: false
  },
  {
    id: 'illustrator',
    name: 'Adobe Illustrator CC',
    category: 'Productivity',
    description: 'Vector graphics editor. Configured with native Windows font mappings and custom GDI graphic rendering.',
    recommended_prefix: 'dxvk-optimized',
    rating: 4.3,
    icon: 'photoshop',
    popular: false
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    category: 'Productivity',
    description: 'Developer IDE editor. Custom sandboxed configurations mapping home directories directly to Z:\\ drive.',
    recommended_prefix: 'productivity',
    rating: 4.6,
    icon: 'generic',
    popular: false
  },
  {
    id: 'notepadplus',
    name: 'Notepad++ Editor',
    category: 'Utilities',
    description: 'Fast, lightweight Windows source editor running flawlessly with default stable prefix environments.',
    recommended_prefix: 'legacy',
    rating: 4.5,
    icon: 'generic',
    popular: false
  },
  {
    id: 'winrar',
    name: 'WinRAR Archiver',
    category: 'Utilities',
    description: 'Classic Windows compressed file compression and extraction utility. Zero dependencies, instant startup.',
    recommended_prefix: 'legacy',
    rating: 4.1,
    icon: 'generic',
    popular: false
  },
  {
    id: 'winamp',
    name: 'Winamp (Legacy Media Player)',
    category: 'Utilities',
    description: 'Classic high-fidelity media player. Extremely lightweight, designed to run flawlessly with default settings.',
    recommended_prefix: 'legacy',
    rating: 4.6,
    icon: 'generic',
    popular: false
  }
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [recipes, setRecipes] = useState<SoftwareRecipe[]>(DEFAULT_RECIPES);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [onboarded, setOnboarded] = useState<boolean>(false);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [wizardRecipeId, setWizardRecipeId] = useState<string | 'custom' | null>(null);
  const [metrics, setMetrics] = useState<SysMetrics>({
    cpu_usage: 0,
    ram_usage_percent: 0,
    ram_used_gb: 0,
    ram_total_gb: 16,
    disk_free_gb: 150,
    gpu_usage: 0,
    fps: 0,
    shader_compilation_percent: 0,
  });

  // Load Initial Data
  const loadData = async () => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        const b = await invoke<Bottle[]>('list_bottles');
        const a = await invoke<AppConfig[]>('list_apps');
        const r = await invoke<Runtime[]>('list_runtimes');
        setBottles(b);
        setApps(a);
        setRuntimes(r);
      } catch (err) {
        console.error("Failed loading data from Tauri backend:", err);
      }
    } else {
      // Mock Fallback
      setBottles([
        {
          id: "bottle-gaming",
          name: "Steam Gaming Bottle",
          prefix_type: "gaming",
          wine_version: "Proton GE 9.0",
          dxvk_enabled: true,
          moltenvk_enabled: true,
          win_version: "win10",
          env_vars: { "DXVK_HUD": "fps", "WINEESYNC": "1" },
          dll_overrides: [{ library: "d3d11", override_type: "native,builtin" }],
          registry_keys: [],
          size_bytes: 3240000000,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/bottle-gaming",
          created_at: "2026-05-10",
        },
        {
          id: "bottle-office",
          name: "MS Office Suite",
          prefix_type: "productivity",
          wine_version: "Wine Stable 9.0",
          dxvk_enabled: false,
          moltenvk_enabled: false,
          win_version: "win10",
          env_vars: {},
          dll_overrides: [],
          registry_keys: [],
          size_bytes: 1120000000,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/bottle-office",
          created_at: "2026-05-18",
        }
      ]);

      setApps([
        {
          id: "app-steam",
          name: "Steam Launcher",
          exe_path: "C:\\Program Files (x86)\\Steam\\Steam.exe",
          arguments: "-nofriendsui",
          icon: "steam",
          category: "Games",
          tags: ["Store", "Online"],
          bottle_id: "bottle-gaming",
          last_played: "2026-05-20T21:40:00Z",
          play_time_mins: 840,
          favorite: true,
        },
        {
          id: "app-cyberpunk",
          name: "Cyberpunk 2077",
          exe_path: "C:\\GOG Games\\Cyberpunk 2077\\bin\\x64\\Cyberpunk2077.exe",
          arguments: "-skipStartScreen",
          icon: "cyberpunk",
          category: "Games",
          tags: ["RPG", "Vulkan", "Action"],
          bottle_id: "bottle-gaming",
          last_played: "2026-05-22T02:15:00Z",
          play_time_mins: 3420,
          favorite: true,
        },
        {
          id: "app-word",
          name: "Microsoft Word",
          exe_path: "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
          arguments: "",
          icon: "office",
          category: "Productivity",
          tags: ["Office", "Docs"],
          bottle_id: "bottle-office",
          last_played: "2026-05-22T14:30:00Z",
          play_time_mins: 120,
          favorite: false,
        }
      ]);

      setRuntimes([
        {
          id: "wine-stable",
          name: "Wine Stable 9.0",
          category: "wine",
          version: "9.0.0",
          size_bytes: 840000000,
          downloaded: true,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/wine-stable",
        },
        {
          id: "proton-ge",
          name: "Proton GE 9.0 (Custom Gaming)",
          category: "proton",
          version: "GE-9.0-1",
          size_bytes: 1280000000,
          downloaded: true,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/proton-ge",
        },
        {
          id: "proton-exp",
          name: "Proton Experimental",
          category: "proton",
          version: "Experimental",
          size_bytes: 1420000000,
          downloaded: false,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/proton-exp",
        },
        {
          id: "dxvk-23",
          name: "DXVK Translation Layer v2.3",
          category: "dxvk",
          version: "2.3.0",
          size_bytes: 28000000,
          downloaded: true,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/dxvk-23",
        },
        {
          id: "dxvk-latest",
          name: "DXVK Master (Nightly Build)",
          category: "dxvk",
          version: "Git-Nightly",
          size_bytes: 31000000,
          downloaded: false,
          path: "/Users/omkar/.gemini/antigravity/scratch/fusionwine/runtimes/dxvk-latest",
        }
      ]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync / Listen to Tauri log events
  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<string>('wine-log-stream', (event) => {
          setLogs((prev) => [...prev.slice(-149), event.payload]); // Limit to 150 log entries
        });

        listen<{ id: string; progress: number }>('download-progress', (event) => {
          const { id, progress } = event.payload;
          setDownloadProgress((prev) => ({ ...prev, [id]: progress }));
          if (progress >= 100) {
            // Update downloaded status in runtimes list
            setRuntimes((prev) =>
              prev.map((r) => (r.id === id ? { ...r, downloaded: true } : r))
            );
          }
        });
      });
    }
  }, []);

  // Poll system resource metrics
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
        // Mock resource metrics
        setMetrics((prev) => {
          const isAppRunning = activeAppId !== null;
          const cpu = isAppRunning
            ? Math.random() * 15 + 40
            : Math.random() * 2 + 1.5;
          const gpu = isAppRunning
            ? Math.random() * 20 + 55
            : Math.random() * 1.5 + 0.5;
          const fps = isAppRunning ? Math.floor(Math.random() * 15 + 80) : 0;
          const shaders = isAppRunning ? Math.min(100, Math.floor(prev.shader_compilation_percent + Math.random() * 2)) : 0;

          return {
            cpu_usage: parseFloat(cpu.toFixed(1)),
            ram_usage_percent: 58.4,
            ram_used_gb: 9.34,
            ram_total_gb: 16.0,
            disk_free_gb: 192.4,
            gpu_usage: parseFloat(gpu.toFixed(1)),
            fps,
            shader_compilation_percent: shaders,
          };
        });
      }
    };

    interval = setInterval(fetchMetrics, 1000);
    return () => clearInterval(interval);
  }, [activeAppId]);

  // Operations
  const createBottle = async (name: string, type: string, wineVersion: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const b = await invoke<Bottle>('create_bottle', { name, prefixType: type, wineVersion });
      setBottles((prev) => [...prev, b]);
    } else {
      const newB: Bottle = {
        id: `bottle-${Math.floor(Math.random() * 1000)}`,
        name,
        prefix_type: type,
        wine_version: wineVersion,
        dxvk_enabled: true,
        moltenvk_enabled: true,
        win_version: "win10",
        env_vars: { "DXVK_HUD": "fps", "WINEESYNC": "1" },
        dll_overrides: [{ library: "d3d11", override_type: "native,builtin" }],
        registry_keys: [],
        size_bytes: 450000000,
        path: `/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/${name.toLowerCase().replace(/\s+/g, '-')}`,
        created_at: new Date().toISOString().split('T')[0],
      };
      setBottles((prev) => [...prev, newB]);
    }
  };

  const removeBottle = async (id: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_bottle', { id });
    }
    setBottles((prev) => prev.filter((b) => b.id !== id));
    setApps((prev) => prev.filter((a) => a.bottle_id !== id));
  };

  const duplicateBottle = async (id: string, name: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const cloned = await invoke<Bottle>('clone_bottle', { id, targetName: name });
      setBottles((prev) => [...prev, cloned]);
    } else {
      const src = bottles.find(b => b.id === id);
      if (src) {
        const cloned: Bottle = {
          ...src,
          id: `bottle-${Math.floor(Math.random() * 1000)}`,
          name,
          created_at: new Date().toISOString().split('T')[0],
        };
        setBottles((prev) => [...prev, cloned]);
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

  const registerApp = async (
    name: string,
    exe: string,
    args: string,
    bottleId: string,
    cat: string,
    tags: string[]
  ) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const newA = await invoke<AppConfig>('register_app', {
        name,
        exePath: exe,
        arguments: args,
        bottleId,
        category: cat,
        tags,
      });
      setApps((prev) => [...prev, newA]);
    } else {
      const newA: AppConfig = {
        id: `app-${Math.floor(Math.random() * 1000)}`,
        name,
        exe_path: exe,
        arguments: args,
        icon: name.toLowerCase().includes("office") ? "office" : "generic",
        category: cat,
        tags,
        bottle_id: bottleId,
        last_played: null,
        play_time_mins: 0,
        favorite: false,
      };
      setApps((prev) => [...prev, newA]);
    }
  };

  const toggleFavorite = async (id: string) => {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      const updated = await invoke<AppConfig>('toggle_favorite', { id });
      setApps((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } else {
      setApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a))
      );
    }
  };

  const launchApp = async (id: string) => {
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
      // Stream mock logs
      const selected = apps.find(a => a.id === id);
      const name = selected ? selected.name : "App";
      
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
          setLogs(prev => [...prev, mockLogs[index]]);
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

  const downloadRuntime = async (id: string) => {
    setDownloadProgress((prev) => ({ ...prev, [id]: 0 }));
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('trigger_runtime_download', { id });
    } else {
      // Mock download speed
      let prog = 0;
      const interval = setInterval(() => {
        prog += Math.floor(Math.random() * 15) + 5;
        if (prog >= 100) {
          prog = 100;
          clearInterval(interval);
          setRuntimes((prev) =>
            prev.map((r) => (r.id === id ? { ...r, downloaded: true } : r))
          );
        }
        setDownloadProgress((prev) => ({ ...prev, [id]: prog }));
      }, 200);
    }
  };

  const installRecipe = async (
    recipeId: string,
    bottleName: string,
    bottleType: string,
    wineVersion: string
  ) => {
    setLogs([]);
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const installLogs = [
      `[FusionWine] Starting CrossOver installer engine...`,
      `[FusionWine] Presets resolved: recommended prefix profile '${bottleType}'.`,
      `[Wine] Creating new sandboxed prefix environment at '/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/${bottleName.toLowerCase().replace(/\\s+/g, '-')}'`,
      `[Wine] Running Wineboot... Initializing registry trees (HKCU, HKLM).`,
      `[Wine] Preloading Direct3D translation layers: DXVK & MoltenVK active.`,
      `[Wine] Downloading setup payload for ${recipe.name}...`,
      `[Wine] Launching silent setup helper: msiexec /i installer.msi`,
      `[Wine] Extracting cabinet files... 100% completed.`,
      `[Wine] Injecting local system fonts: Arial, Comic Sans, Segoe UI.`,
      `[Wine] Setup installer finished with exit code 0.`,
      `[FusionWine] Successfully registered '${recipe.name}' into library database!`
    ];

    setDownloadProgress((prev) => ({ ...prev, [recipeId]: 0 }));

    await createBottle(bottleName, bottleType, wineVersion);
    const newBottleId = `bottle-${Math.floor(Math.random() * 1000)}`;

    return new Promise<void>((resolve) => {
      let progress = 0;
      let logIndex = 0;
      const interval = setInterval(() => {
        progress += 10;
        setDownloadProgress((prev) => ({ ...prev, [recipeId]: progress }));

        if (logIndex < installLogs.length) {
          setLogs((prev) => [...prev, installLogs[logIndex]]);
          logIndex++;
        }

        if (progress >= 100) {
          clearInterval(interval);
          
          const customExePath = `C:\\\\Program Files\\\\${recipe.name}\\\\${recipe.name}.exe`;
          registerApp(
            recipe.name,
            customExePath,
            recipe.recommended_prefix === 'gaming' ? '-fullscreen' : '',
            bottles[bottles.length - 1]?.id || newBottleId,
            recipe.category,
            ['Installed', 'Recipe']
          );
          resolve();
        }
      }, 400);
    });
  };

  const runCustomExe = async (bottleId: string, exePath: string, args: string) => {
    setLogs([]);
    const bottle = bottles.find(b => b.id === bottleId) || bottles[0];
    const prefixPath = bottle ? bottle.path : '/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles/default';
    
    const runLogs = [
      `[Wine] Initializing Custom Executable Execution...`,
      `[Wine] Executable Path: ${exePath}`,
      `[Wine] Prefix Context: ${prefixPath}`,
      `[Wine] Shell Arguments: ${args}`,
      `[Wine] Environment: WINEPREFIX=${prefixPath} DXVK_HUD=fps WINEESYNC=1`,
      `[Wine] Pre-compiling Vulkan shader pipelines (pipeline cache: active)...`,
      `[Wine] Spawning process (CPU Affinity: 0xFC)...`,
      `[Wine] Process active. Main output stream hooked.`,
      `[Wine] Output: Initializing resources...`,
      `[Wine] Output: Audio output initialized on core audio device.`,
      `[Wine] Output: Execution completed successfully.`
    ];

    let logIndex = 0;
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (logIndex < runLogs.length) {
          setLogs((prev) => [...prev, runLogs[logIndex]]);
          logIndex++;
        } else {
          clearInterval(interval);
          resolve();
        }
      }, 300);
    });
  };

  const clearLogs = () => setLogs([]);

  const addCustomRecipe = (recipe: Omit<SoftwareRecipe, 'id'>) => {
    const newRecipe: SoftwareRecipe = {
      ...recipe,
      id: `custom-${Math.floor(Math.random() * 10000)}`
    };
    setRecipes((prev) => [...prev, newRecipe]);
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
        clearLogs,
        downloadProgress,
        onboarded,
        setOnboarded,
        createBottle,
        removeBottle,
        duplicateBottle,
        updateBottle,
        registerApp,
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

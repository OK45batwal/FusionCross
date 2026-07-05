import { useState } from 'react';
import { SoftwareRecipe, InstallResult, DiscoveredApp, Bottle } from '../types';

const isTauri = () =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

const DEFAULT_RECIPES: SoftwareRecipe[] = [
  {
    id: 'steam', name: 'Steam Launcher', category: 'Games',
    description: "Valve's digital storefront and hub for thousands of PC games. Optimized with DXVK rendering.",
    recommended_prefix: 'gaming', rating: 4.8, icon: 'steam', popular: true,
  },
  {
    id: 'office', name: 'Microsoft Office Suite', category: 'Productivity',
    description: 'Includes Word, Excel, and PowerPoint. Optimized with standard windows configurations and pre-loaded fonts.',
    recommended_prefix: 'productivity', rating: 4.2, icon: 'office', popular: true,
  },
  {
    id: 'photoshop', name: 'Adobe Photoshop CC', category: 'Productivity',
    description: 'Premier graphic design suite. Requires legacy DLL compatibility and custom registry patches.',
    recommended_prefix: 'dxvk-optimized', rating: 4.5, icon: 'photoshop', popular: true,
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk 2077', category: 'Games',
    description: 'Next-gen action RPG. High-performance gaming template pre-configured with MoltenVK to Metal translation.',
    recommended_prefix: 'gaming', rating: 4.9, icon: 'cyberpunk', popular: true,
  },
  {
    id: 'flstudio', name: 'FL Studio 21', category: 'Productivity',
    description: 'Professional digital audio workstation (DAW). Optimized with CoreAudio ASIO wrappers for low-latency recording.',
    recommended_prefix: 'productivity', rating: 4.7, icon: 'generic', popular: true,
  },
  {
    id: 'discord', name: 'Discord (Voice & Chat)', category: 'Utilities',
    description: 'Popular vocal and text chat client. Optimized with lightweight thread allocations and low-latency system overrides.',
    recommended_prefix: 'lightweight', rating: 4.4, icon: 'generic', popular: true,
  },
  {
    id: 'witcher3', name: 'The Witcher 3: Wild Hunt', category: 'Games',
    description: 'Fantasy action-RPG masterpiece. Includes DXVK v2.3 shaders pre-caching and customized retina scaling settings.',
    recommended_prefix: 'gaming', rating: 4.9, icon: 'witcher', popular: false,
  },
  {
    id: 'gtav', name: 'Grand Theft Auto V', category: 'Games',
    description: 'Open-world crime epic. Performance profile includes MoltenVK translation and low CPU-overhead environment flags.',
    recommended_prefix: 'gaming', rating: 4.8, icon: 'generic', popular: false,
  },
  {
    id: 'illustrator', name: 'Adobe Illustrator CC', category: 'Productivity',
    description: 'Vector graphics editor. Configured with native Windows font mappings and custom GDI graphic rendering.',
    recommended_prefix: 'dxvk-optimized', rating: 4.3, icon: 'photoshop', popular: false,
  },
  {
    id: 'vscode', name: 'Visual Studio Code', category: 'Productivity',
    description: 'Developer IDE editor. Custom sandboxed configurations mapping home directories directly to Z:\\ drive.',
    recommended_prefix: 'productivity', rating: 4.6, icon: 'generic', popular: false,
  },
  {
    id: 'notepadplus', name: 'Notepad++ Editor', category: 'Utilities',
    description: 'Fast, lightweight Windows source editor running flawlessly with default stable prefix environments.',
    recommended_prefix: 'legacy', rating: 4.5, icon: 'generic', popular: false,
  },
  {
    id: 'winrar', name: 'WinRAR Archiver', category: 'Utilities',
    description: 'Classic Windows compressed file compression and extraction utility. Zero dependencies, instant startup.',
    recommended_prefix: 'legacy', rating: 4.1, icon: 'generic', popular: false,
  },
  {
    id: 'winamp', name: 'Winamp (Legacy Media Player)', category: 'Utilities',
    description: 'Classic high-fidelity media player. Extremely lightweight, designed to run flawlessly with default settings.',
    recommended_prefix: 'legacy', rating: 4.6, icon: 'generic', popular: false,
  },
];

export function useRecipes(
  bottles: Bottle[],
  createBottle: (name: string, type: string, wineVersion: string) => Promise<Bottle>,
  registerApp: (name: string, exe: string, args: string, bottleId: string, cat: string, tags: string[]) => Promise<void>,
  setLogs: React.Dispatch<React.SetStateAction<string[]>>,
  setDownloadProgress: React.Dispatch<React.SetStateAction<Record<string, number>>>,
) {
  const [recipes, setRecipes] = useState<SoftwareRecipe[]>(DEFAULT_RECIPES);

  const installRecipe = async (
    recipeId: string,
    bottleName: string,
    bottleType: string,
    wineVersion: string,
    customAppName?: string,
    customExePath?: string,
    targetBottleId?: string,
  ) => {
    setLogs([]);
    let name = '';
    let category = 'Utilities';
    let exe = '';
    const isCustom = recipeId === 'custom';

    if (isCustom) {
      name = customAppName || 'Custom Application';
      exe = customExePath || '';
      if (!exe.trim()) {
        setLogs((prev) => [...prev, `[FusionCross:Error] Custom installer path is required.`]);
        return;
      }
    } else {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;
      name = recipe.name;
      category = recipe.category;
    }

    setDownloadProgress((prev) => ({ ...prev, [recipeId]: 0 }));

    const existingBottle = targetBottleId ? bottles.find((b) => b.id === targetBottleId) : undefined;
    if (targetBottleId && !existingBottle) {
      setLogs((prev) => [...prev, `[FusionCross:Error] Target bottle '${targetBottleId}' was not found.`]);
      return;
    }

    const b = existingBottle || (await createBottle(bottleName, bottleType, wineVersion));
    setDownloadProgress((prev) => ({ ...prev, [recipeId]: 30 }));

    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      try {
        if (isCustom && exe) {
          setLogs((prev) => [...prev, `[FusionCross] Preparing custom binary execution...`]);
          setLogs((prev) => [...prev, `[FusionCross] WINEPREFIX: ${b.path}`]);
          setLogs((prev) => [...prev, `[FusionCross] Executing target installer: ${exe}`]);
          setDownloadProgress((prev) => ({ ...prev, [recipeId]: 50 }));

          const install = await invoke<InstallResult>('install_windows_software', {
            prefixPath: b.path,
            installerPath: exe,
            arguments: '',
          });
          setLogs((prev) => [...prev, `[FusionCross] ${install.message}`]);
          if (!install.success) {
            throw new Error(`Installer exited with code ${install.exit_code}`);
          }

          setDownloadProgress((prev) => ({ ...prev, [recipeId]: 80 }));

          setLogs((prev) => [...prev, `[FusionCross] Scanning prefix folders for newly deployed executables...`]);
          const scanned: DiscoveredApp[] = await invoke('scan_apps', { bottleId: b.id });
          if (scanned && scanned.length > 0) {
            exe = scanned[0].path;
            name = scanned[0].name;
            setLogs((prev) => [...prev, `[FusionCross] Discovered executable: ${exe}`]);
          }

          setLogs((prev) => [...prev, `[FusionCross] Registering '${name}' shortcut inside library catalog...`]);
          await registerApp(name, exe, '', b.id, category, ['Installed', 'Custom']);
        } else {
          setLogs((prev) => [...prev, `[FusionCross] Creating ${bottleType} bottle for '${name}'...`]);
          setDownloadProgress((prev) => ({ ...prev, [recipeId]: 50 }));
          setLogs((prev) => [...prev, `[FusionCross] Bottle '${b.name}' is ready (${b.id}).`]);
          setLogs((prev) => [...prev, `[FusionCross] To install software, use Custom Install with a real .exe/.msi file targeting this bottle.`]);
        }
        setDownloadProgress((prev) => ({ ...prev, [recipeId]: 100 }));
      } catch (err: any) {
        setLogs((prev) => [...prev, `[FusionCross:Error] Installation failed: ${err}`]);
        setDownloadProgress((prev) => ({ ...prev, [recipeId]: 0 }));
      }
    } else {
      setLogs((prev) => [...prev, `[FusionCross] Real install workflow is available only in the desktop app (Tauri mode).`]);
      setDownloadProgress((prev) => ({ ...prev, [recipeId]: 0 }));
    }
  };

  const addCustomRecipe = (recipe: Omit<SoftwareRecipe, 'id'>) => {
    const newRecipe: SoftwareRecipe = { ...recipe, id: `custom-${Math.floor(Math.random() * 10000)}` };
    setRecipes((prev) => [...prev, newRecipe]);
  };

  return { recipes, setRecipes, installRecipe, addCustomRecipe };
}

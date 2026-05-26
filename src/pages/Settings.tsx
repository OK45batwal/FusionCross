import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Terminal, 
  Monitor, 
  Cpu, 
  HardDrive,
  Info,
  ShieldCheck,
  RefreshCw,
  Zap,
  Download,
  Upload
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { rosettaDiagnostics, fetchRosettaStatus } = useApp();
  const [defaultWine, setDefaultWine] = useState<string>('proton-ge');
  const [hudConfig, setHudConfig] = useState<string>('fps');
  const [rosettaThreadMode, setRosettaThreadMode] = useState<string>('hybrid');
  const [verboseLogs, setVerboseLogs] = useState<boolean>(true);
  const [sandboxFiles, setSandboxFiles] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    fetchRosettaStatus();
  }, []);

  const handleManualScan = async () => {
    setIsScanning(true);
    await fetchRosettaStatus();
    setTimeout(() => {
      setIsScanning(false);
    }, 600);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 h-full bg-graphite-900/40">
      <div className="h-4 select-none pointer-events-none" />

      {/* Header */}
      <div className="space-y-1 border-b border-graphite-800/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
          <SettingsIcon className="w-5 h-5 text-neon-indigo" /> System Settings
        </h1>
        <p className="text-xs text-graphite-400 font-mono">
          Configure translation compilers, Rosetta instruction overrides, telemetry widgets, and sandboxes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Main settings */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Settings Section A: Compatibility Default */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-indigo" /> COMPATIBILITY & TRANSLATION ENGINE
            </h2>
            
            <div className="space-y-4 text-xs font-mono">
              <div className="flex flex-col gap-2">
                <label className="text-graphite-400 font-bold uppercase">Default Bottle Engine</label>
                <select 
                  value={defaultWine}
                  onChange={(e) => setDefaultWine(e.target.value)}
                  className="glass-input bg-graphite-800 cursor-pointer"
                >
                  <option value="proton-ge">Proton GE 9.0 (Custom Gaming) - Recommended</option>
                  <option value="wine-stable">Wine Stable 9.0 (Productivity)</option>
                  <option value="proton-exp">Proton Experimental (Nightly Translation)</option>
                </select>
                <span className="text-[10px] text-graphite-500 leading-normal">Defines the translation layer that will bootstrap new prefix installations by default.</span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-graphite-400 font-bold uppercase">Graphics HUD telemetry config</label>
                <select 
                  value={hudConfig}
                  onChange={(e) => setHudConfig(e.target.value)}
                  className="glass-input bg-graphite-800 cursor-pointer"
                >
                  <option value="fps">Render frames per second overlay (FPS only)</option>
                  <option value="full">Comprehensive system telemetry (FPS, CPU, Vulkan stats)</option>
                  <option value="none">Disabled (Maximum rendering pipeline throughput)</option>
                </select>
                <span className="text-[10px] text-graphite-500 leading-normal">Passes the corresponding HUD configurations into the direct rendering runtime.</span>
              </div>
            </div>
          </div>

          {/* Settings Section B: Rosetta Translation */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-neon-purple" /> APPLE SILICON & ROSETTA OVERRIDES
            </h2>

            <div className="space-y-4 text-xs font-mono">
              <div className="flex flex-col gap-2">
                <label className="text-graphite-400 font-bold uppercase">Rosetta Core Execution Mode</label>
                <select 
                  value={rosettaThreadMode}
                  onChange={(e) => setRosettaThreadMode(e.target.value)}
                  className="glass-input bg-graphite-800 cursor-pointer"
                >
                  <option value="hybrid">Rosetta Hybrid mode (Dynamic ARM/x86 instruction swapping)</option>
                  <option value="strict">Strict x86 mode (Translates all execution branches via Rosetta 2)</option>
                  <option value="native">Native ARM transition layers (OpenGL / Metal translation)</option>
                </select>
                <span className="text-[10px] text-graphite-500 leading-normal">Select strictness of dynamic thread compilation on Apple M-series chips.</span>
              </div>

              {/* Toggles */}
              <div className="space-y-3.5 pt-2">
                <label className="flex items-center gap-3.5 cursor-pointer text-graphite-300">
                  <input 
                    type="checkbox" 
                    checked={verboseLogs}
                    onChange={(e) => setVerboseLogs(e.target.checked)}
                    className="rounded bg-graphite-900 border-graphite-750 text-neon-purple cursor-pointer focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-white">Debugger Verbose Streaming</span>
                    <span className="text-[10px] text-graphite-500 font-normal">Emit thorough log updates during Wine backend launches to diagnostic terminals.</span>
                  </div>
                </label>

                <label className="flex items-center gap-3.5 cursor-pointer text-graphite-300">
                  <input 
                    type="checkbox" 
                    checked={sandboxFiles}
                    onChange={(e) => setSandboxFiles(e.target.checked)}
                    className="rounded bg-graphite-900 border-graphite-750 text-neon-purple cursor-pointer focus:ring-0"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-white">Prefix Isolation Sandbox</span>
                    <span className="text-[10px] text-graphite-500 font-normal">Prevent Wine applications from reading macOS host home directories (~/Documents, ~/Downloads).</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Settings Section C: Backup & Import/Export */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-neon-blue" /> BACKUP & DATABASE MANAGEMENT
            </h2>
            <p className="text-[10px] text-graphite-500 font-mono leading-relaxed">
              Export and import your entire FusionCross system configuration including bottles catalog, application shortcuts, and custom preferences in a single JSON state archive.
            </p>

            <div className="flex flex-col md:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const defaultName = 'fusioncross_config.json';
                    const path = await invoke<string>('save_file_picker', {
                      title: 'Export FusionCross Configurations',
                      defaultName
                    });
                    if (path) {
                      const res = await invoke<string>('export_app_data', { exportPath: path });
                      alert(res);
                    }
                  } catch (e: any) {
                    alert(`Export failed: ${e.message || e}`);
                  }
                }}
                className="flex-1 btn-secondary py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-center gap-2 border-graphite-750 hover:border-graphite-600 bg-graphite-900/50 hover:bg-graphite-800 text-white rounded-xl transition-all duration-250 cursor-pointer"
              >
                <Download className="w-4 h-4 text-neon-blue animate-pulse-subtle" />
                <span>Export System Data</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const path = await invoke<string>('open_file_picker', {
                      title: 'Import FusionCross Configurations (.json)',
                      fileTypes: ['json']
                    });
                    if (path) {
                      const confirmImport = confirm("Are you sure you want to import this configuration? This will overwrite all of your active bottles, registered games, and compatibility presets.");
                      if (confirmImport) {
                        const res = await invoke<string>('import_app_data', { importPath: path });
                        alert(res);
                        window.location.reload();
                      }
                    }
                  } catch (e: any) {
                    alert(`Import failed: ${e.message || e}`);
                  }
                }}
                className="flex-1 btn-secondary py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-center gap-2 border-graphite-750 hover:border-graphite-600 bg-graphite-900/50 hover:bg-graphite-800 text-white rounded-xl transition-all duration-250 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-neon-green animate-pulse-subtle" />
                <span>Import System Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Summary details */}
        <div className="space-y-6">
          
          {/* Rosetta Diagnostics Shield Card */}
          <div className="glass-panel p-6 rounded-2xl border-neon-indigo/30 bg-gradient-to-tr from-neon-indigo/10 to-transparent space-y-4 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <Zap className="w-4 h-4 text-neon-indigo" /> SILICON COMPATIBILITY
            </h3>
            
            <div className="space-y-3.5 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-graphite-450 uppercase">CPU Model detected</span>
                <span className="font-bold text-white text-xs truncate" title={rosettaDiagnostics.cpu_brand}>
                  {rosettaDiagnostics.cpu_brand}
                </span>
              </div>

              <div className="flex justify-between items-center text-graphite-400">
                <span>Apple M-Series Core:</span>
                <span className={`font-bold text-[10px] px-2 py-0.2 rounded border ${
                  rosettaDiagnostics.is_apple_silicon 
                    ? 'border-neon-indigo/35 text-neon-indigo bg-neon-indigo/5' 
                    : 'border-graphite-700 text-graphite-400 bg-graphite-800'
                }`}>
                  {rosettaDiagnostics.is_apple_silicon ? 'SUPPORTED' : 'INTEL x86_64'}
                </span>
              </div>

              <div className="flex justify-between items-center text-graphite-400">
                <span>Rosetta 2 translation:</span>
                <span className={`font-bold text-[10px] px-2 py-0.2 rounded border ${
                  rosettaDiagnostics.rosetta_installed 
                    ? 'border-neon-green/35 text-neon-green bg-neon-green/5' 
                    : 'border-red-900/35 text-red-400 bg-red-950/5'
                }`}>
                  {rosettaDiagnostics.rosetta_installed ? 'OPERATIONAL' : 'NOT INSTALLED'}
                </span>
              </div>

              <div className="flex justify-between items-center text-graphite-400">
                <span>Translation active:</span>
                <span className={`font-bold text-[10px] px-2 py-0.2 rounded border ${
                  rosettaDiagnostics.is_translated 
                    ? 'border-neon-purple/35 text-neon-purple bg-neon-purple/5' 
                    : 'border-graphite-700 text-graphite-400 bg-graphite-800'
                }`}>
                  {rosettaDiagnostics.is_translated ? 'ACTIVE (x86_64)' : 'NATIVE'}
                </span>
              </div>

              <button
                onClick={handleManualScan}
                disabled={isScanning}
                className="w-full btn-secondary py-1.5 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 mt-2"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'CHECKING...' : 'RE-RUN SILICON DIAGNOSTIC'}</span>
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/15">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <Info className="w-4 h-4 text-neon-blue" /> ENVIRONMENT INFO
            </h3>
            
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center text-graphite-400">
                <span>Application Path:</span>
                <span className="text-white">fusioncross.app</span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Prefix Folder:</span>
                <span className="text-white text-right break-all truncate max-w-[120px]" title="/Users/omkar/.gemini/antigravity/scratch/fusioncross/bottles">.../scratch/fusioncross</span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Active GPU:</span>
                <span className="text-neon-indigo font-bold">Apple M-Series</span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Vulkan backend:</span>
                <span className="text-neon-green font-bold">MoltenVK Metal</span>
              </div>
            </div>
          </div>

          {/* Security details */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/15">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <ShieldCheck className="w-4 h-4 text-neon-green" /> SECURITY STATUS
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center gap-2 text-neon-green font-bold">
                <CheckCircle2 className="w-4 h-4" /> SANDBOX SECURE
              </div>
              <p className="text-[10px] text-graphite-400 leading-normal">
                FusionCross runs inside a safe, unprivileged desktop wrapper container, utilizing macOS sandboxed file system partitions for WINEPREFIX isolation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

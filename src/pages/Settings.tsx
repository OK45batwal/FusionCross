import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  Terminal, 
  Monitor, 
  Cpu, 
  HardDrive,
  Info,
  ShieldCheck
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [defaultWine, setDefaultWine] = useState<string>('proton-ge');
  const [hudConfig, setHudConfig] = useState<string>('fps');
  const [rosettaThreadMode, setRosettaThreadMode] = useState<string>('hybrid');
  const [verboseLogs, setVerboseLogs] = useState<boolean>(true);
  const [sandboxFiles, setSandboxFiles] = useState<boolean>(true);
  const [themeMode, setThemeMode] = useState<string>('graphite-dark');

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
        </div>

        {/* Column 3: Summary details */}
        <div className="space-y-6">
          {/* Info Card */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/15">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <Info className="w-4 h-4 text-neon-blue" /> ENVIRONMENT INFO
            </h3>
            
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center text-graphite-400">
                <span>Application Path:</span>
                <span className="text-white">fusionwine.app</span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Prefix Folder:</span>
                <span className="text-white text-right break-all truncate max-w-[120px]" title="/Users/omkar/.gemini/antigravity/scratch/fusionwine/bottles">.../scratch/fusionwine</span>
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
                FusionWine runs inside a safe, unprivileged desktop wrapper container, utilizing macOS sandboxed file system partitions for WINEPREFIX isolation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

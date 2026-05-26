import React, { useState } from 'react';
import { useApp } from '../store';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Plus, 
  Database, 
  FolderOpen, 
  CheckCircle2, 
  DownloadCloud,
  Layers,
  Wrench,
  Search,
  Check
} from 'lucide-react';
import { SoftwareRecipe } from '../types';

interface InstallWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallWizard: React.FC<InstallWizardProps> = ({ isOpen, onClose }) => {
  const { 
    recipes, 
    bottles, 
    runtimes, 
    installRecipe, 
    downloadProgress, 
    logs,
    clearLogs,
    wizardRecipeId,
    setWizardRecipeId
  } = useApp();

  const [step, setStep] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Selection state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | 'custom' | null>(null);
  
  // Custom EXE State
  const [customAppName, setCustomAppName] = useState<string>('');
  const [customExePath, setCustomExePath] = useState<string>('');

  // Target Bottle Config
  const [bottleMode, setBottleMode] = useState<'new' | 'existing'>('new');
  const [selectedBottleId, setSelectedBottleId] = useState<string>(bottles[0]?.id || '');
  const [newBottleName, setNewBottleName] = useState<string>('');
  const [newBottleType, setNewBottleType] = useState<string>('gaming');
  const [newWineVersion, setNewWineVersion] = useState<string>('Proton GE 9.0');

  // Install Action State
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen && wizardRecipeId) {
      setSelectedRecipeId(wizardRecipeId);
      if (wizardRecipeId === 'custom') {
        setNewBottleName('Custom App Bottle');
        setNewBottleType('gaming');
      } else {
        const rec = recipes.find(r => r.id === wizardRecipeId);
        if (rec) {
          setNewBottleName(`${rec.name} Bottle`);
          setNewBottleType(rec.recommended_prefix);
        }
      }
      setStep(2); // Skip category selection, go directly to bottle details config
    } else if (isOpen) {
      setStep(1);
      setSelectedRecipeId(null);
    }
  }, [isOpen, wizardRecipeId, recipes]);

  if (!isOpen) return null;

  const activeRuntimes = runtimes.filter(r => r.downloaded && (r.category === 'wine' || r.category === 'proton'));
  const filteredRecipes = recipes.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  const handleSelectRecipe = (id: string | 'custom') => {
    setSelectedRecipeId(id);
    if (id === 'custom') {
      setNewBottleName('Custom App Bottle');
      setNewBottleType('gaming');
    } else {
      const rec = recipes.find(r => r.id === id);
      if (rec) {
        setNewBottleName(`${rec.name} Bottle`);
        setNewBottleType(rec.recommended_prefix);
      }
    }
  };

  const handleNextStep = () => {
    if (step === 1 && !selectedRecipeId) return;
    if (step === 1 && selectedRecipeId === 'custom' && (!customAppName || !customExePath)) return;
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    setStep(3);
    clearLogs();

    const finalBottleName = bottleMode === 'new' ? newBottleName : (bottles.find(b => b.id === selectedBottleId)?.name || 'Default Bottle');
    const finalBottleType = bottleMode === 'new' ? newBottleType : (bottles.find(b => b.id === selectedBottleId)?.prefix_type || 'gaming');
    const finalWineVersion = bottleMode === 'new' ? newWineVersion : (bottles.find(b => b.id === selectedBottleId)?.wine_version || 'Wine Stable 9.0');
    const targetBottleId = bottleMode === 'existing' ? selectedBottleId : undefined;

    try {
      if (selectedRecipeId === 'custom') {
        await installRecipe('custom', finalBottleName, finalBottleType, finalWineVersion, customAppName, customExePath, targetBottleId);
      } else if (selectedRecipeId) {
        await installRecipe(selectedRecipeId, finalBottleName, finalBottleType, finalWineVersion, undefined, undefined, targetBottleId);
      }
      setStep(4);
    } catch (err) {
      console.error(err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleClose = () => {
    // Reset all state on close
    setStep(1);
    setSelectedRecipeId(null);
    setCustomAppName('');
    setCustomExePath('');
    setBottleMode('new');
    setNewBottleName('');
    setIsInstalling(false);
    setWizardRecipeId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-graphite-950/85 backdrop-blur-md flex items-center justify-center p-6 transition-all duration-300">
      <div className="glass-panel-glow w-full max-w-2xl rounded-2xl overflow-hidden border border-neon-purple/20 flex flex-col relative max-h-[85vh] shadow-[0_0_50px_rgba(157,78,221,0.15)] bg-graphite-950/90">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-graphite-800/40 bg-graphite-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-neon-purple/10 border border-neon-purple/35 rounded-lg text-neon-purple">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Windows Software Setup Wizard</h2>
              <p className="text-[10px] text-graphite-400 font-mono">Step {step} of 4: {
                step === 1 ? 'Select Application' :
                step === 2 ? 'Prefix Configuration' :
                step === 3 ? 'Deployment Telemetry' : 'Complete!'
              }</p>
            </div>
          </div>
          {!isInstalling && (
            <button 
              onClick={handleClose}
              className="p-1.5 hover:bg-graphite-850 rounded-lg text-graphite-400 hover:text-white transition-all scale-105 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dynamic Wizard Steps View */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[350px]">
          
          {/* STEP 1: CHOOSE APPLICATION RECIPE OR CUSTOM EXE */}
          {step === 1 && (
            <div className="space-y-5 h-full flex flex-col">
              <div className="space-y-1">
                <span className="text-xs font-bold font-mono uppercase text-white tracking-wide">Choose Application to Deploy</span>
                <p className="text-[11px] text-graphite-400">Select a pre-seeded installer preset from our active catalog recipes or select a custom local windows .exe program from your system.</p>
              </div>

              {/* Search filter */}
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-graphite-400" />
                <input 
                  type="text"
                  placeholder="Filter active recipes catalog..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input pl-9 py-1.5 font-mono text-xs w-full"
                />
              </div>

              {/* Recipes grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                {filteredRecipes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectRecipe(r.id)}
                    className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 ${
                      selectedRecipeId === r.id 
                        ? 'bg-gradient-to-r from-neon-purple/15 to-neon-indigo/5 border-neon-purple/50 shadow-[0_0_12px_rgba(157,78,221,0.06)]' 
                        : 'bg-graphite-900/40 border-graphite-850 hover:bg-graphite-800/40 hover:border-graphite-700/60'
                    }`}
                  >
                    <div className="p-2 bg-graphite-900/80 border border-graphite-800 rounded-lg text-white font-bold font-mono text-xs uppercase shrink-0 mt-0.5">
                      {r.icon === 'steam' ? '🎮' : r.icon === 'office' ? '💼' : r.icon === 'photoshop' ? '🖼️' : '💾'}
                    </div>
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex justify-between items-center pr-1">
                        <span className="text-xs font-bold text-white truncate">{r.name}</span>
                        {selectedRecipeId === r.id && <Check className="w-3.5 h-3.5 text-neon-purple shrink-0" />}
                      </div>
                      <p className="text-[10px] text-graphite-400 leading-relaxed line-clamp-2">{r.description}</p>
                      <div className="flex items-center gap-1.5 text-[8px] font-mono text-graphite-400 uppercase pt-0.5">
                        <span className="bg-graphite-800 px-1 py-0.2 rounded border border-graphite-700/40">{r.category}</span>
                        <span>⭐ {r.rating}</span>
                      </div>
                    </div>
                  </button>
                ))}

                {/* Custom EXE Selection Card */}
                <button
                  onClick={() => handleSelectRecipe('custom')}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 col-span-1 md:col-span-2 ${
                    selectedRecipeId === 'custom' 
                      ? 'bg-gradient-to-r from-neon-blue/15 to-transparent border-neon-blue/50 shadow-[0_0_12px_rgba(0,180,216,0.06)]' 
                      : 'bg-graphite-900/40 border-graphite-850 hover:bg-graphite-800/40 hover:border-graphite-700/60'
                  }`}
                >
                  <div className="p-2 bg-graphite-900/80 border border-graphite-800 rounded-lg text-neon-blue shrink-0 mt-0.5">
                    <FolderOpen className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        Run Custom Installer Executable (.exe) <span className="bg-neon-blue/10 border border-neon-blue/20 text-neon-blue text-[8px] px-1 py-0.2 rounded">CUSTOM FILE</span>
                      </span>
                      {selectedRecipeId === 'custom' && <Check className="w-3.5 h-3.5 text-neon-blue" />}
                    </div>
                    <p className="text-[10px] text-graphite-400 leading-relaxed">Choose this option if you have downloaded a custom installation executable from your browser and want to deploy it in a new bottle prefix.</p>
                  </div>
                </button>
              </div>

              {/* Custom Executable Fields Details (Hidden unless 'custom' chosen) */}
              {selectedRecipeId === 'custom' && (
                <div className="glass-panel p-4 rounded-xl border-neon-blue/20 bg-neon-blue/5 space-y-3.5 max-w-xl animate-fade-in">
                  <div className="text-[10px] font-bold font-mono text-white border-b border-graphite-800 pb-1 uppercase tracking-wide flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-neon-blue" /> Specify Installer Configuration
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold font-mono text-graphite-400 uppercase">Application Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Winamp Pro, Notepad++"
                        value={customAppName}
                        onChange={(e) => setCustomAppName(e.target.value)}
                        className="glass-input py-1.5 font-mono text-xs w-full"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold font-mono text-graphite-400 uppercase">Local Installer Path (.exe)</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="text" 
                          placeholder="e.g. /Users/omkar/Downloads/setup.exe"
                          value={customExePath}
                          onChange={(e) => setCustomExePath(e.target.value)}
                          className="glass-input py-1.5 font-mono text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const { invoke } = await import('@tauri-apps/api/core');
                              const path = await invoke<string>('open_file_picker', {
                                title: 'Select Windows Executable (.exe)',
                                fileTypes: ['exe']
                              });
                              if (path) {
                                setCustomExePath(path);
                                if (!customAppName) {
                                  const parts = path.split('/');
                                  const file = parts[parts.length - 1];
                                  setCustomAppName(file.replace('.exe', '').replace('.EXE', ''));
                                }
                              }
                            } catch (e) {
                              console.error('Error invoking open_file_picker:', e);
                            }
                          }}
                          className="btn-secondary py-1.5 px-3 text-[10px] font-mono font-bold flex items-center gap-1.5 text-neon-blue border-neon-blue/20 hover:border-neon-blue bg-neon-blue/5 hover:bg-neon-blue/10 rounded-lg cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Browse...</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CHOOSE TARGET PREFIX BOTTLE */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold font-mono uppercase text-white tracking-wide">Configure Target compatibility Bottle</span>
                <p className="text-[11px] text-graphite-400">Choose if you want to deploy this application inside a brand new isolated bottle prefix, or merge it within an existing environment prefix.</p>
              </div>

              {/* Selector buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setBottleMode('new')}
                  className={`flex-1 p-3.5 rounded-xl border font-mono text-xs font-bold transition-all text-center flex flex-col items-center gap-2 ${
                    bottleMode === 'new' 
                      ? 'border-neon-purple bg-neon-purple/5 text-white' 
                      : 'border-graphite-800 bg-graphite-900/10 text-graphite-400 hover:text-graphite-250 hover:bg-graphite-800/10'
                  }`}
                >
                  <Plus className="w-5 h-5 text-neon-purple" /> CREATE NEW ISOLATED BOTTLE
                </button>
                <button
                  onClick={() => setBottleMode('existing')}
                  disabled={bottles.length === 0}
                  className={`flex-1 p-3.5 rounded-xl border font-mono text-xs font-bold transition-all text-center flex flex-col items-center gap-2 ${
                    bottles.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    bottleMode === 'existing' 
                      ? 'border-neon-indigo bg-neon-indigo/5 text-white' 
                      : 'border-graphite-800 bg-graphite-900/10 text-graphite-400 hover:text-graphite-250 hover:bg-graphite-800/10'
                  }`}
                >
                  <Database className="w-5 h-5 text-neon-indigo" /> DEPLOY TO EXISTING BOTTLE
                </button>
              </div>

              {/* Mode A: New Bottle config */}
              {bottleMode === 'new' && (
                <div className="glass-panel p-4 rounded-xl border-graphite-800 bg-graphite-950/20 grid grid-cols-2 gap-3.5 max-w-xl animate-fade-in font-mono text-xs">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-graphite-400 uppercase">New Bottle/Prefix Title</label>
                    <input 
                      type="text" 
                      value={newBottleName}
                      onChange={(e) => setNewBottleName(e.target.value)}
                      placeholder="e.g. Steam Prefix, Legacy Utility"
                      className="glass-input py-1.5 font-bold font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-graphite-400 uppercase">Preset Profile Template</label>
                    <select
                      value={newBottleType}
                      onChange={(e) => setNewBottleType(e.target.value)}
                      className="glass-input py-1.5 bg-graphite-850 cursor-pointer font-bold"
                    >
                      <option value="gaming">🎮 Gaming (DXVK & ESYNC)</option>
                      <option value="productivity">💼 Productivity (Minimal dependencies)</option>
                      <option value="dxvk-optimized">⚡ DirectX Optimized (Direct DX-to-VK)</option>
                      <option value="legacy">💾 Legacy (Windows XP core presets)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-graphite-400 uppercase">Wine Engine Engine</label>
                    <select
                      value={newWineVersion}
                      onChange={(e) => setNewWineVersion(e.target.value)}
                      className="glass-input py-1.5 bg-graphite-850 cursor-pointer"
                    >
                      {activeRuntimes.length > 0 ? (
                        activeRuntimes.map(r => (
                          <option key={r.id} value={r.name}>{r.name}</option>
                        ))
                      ) : (
                        <option value="Wine Stable 9.0">Wine Stable 9.0</option>
                      )}
                    </select>
                  </div>

                  {selectedRecipe && (
                    <div className="col-span-2 text-[10px] text-neon-purple bg-neon-purple/5 border border-neon-purple/10 p-2.5 rounded-lg leading-relaxed mt-2.5">
                      💡 <strong>Recipe Recommendation:</strong> '{selectedRecipe.name}' is highly recommended to run inside a **{selectedRecipe.recommended_prefix.toUpperCase()}** optimized prefix bottle environment for high compatibility rate.
                    </div>
                  )}
                </div>
              )}

              {/* Mode B: Existing Bottle config */}
              {bottleMode === 'existing' && (
                <div className="glass-panel p-4 rounded-xl border-graphite-800 bg-graphite-950/20 space-y-3 max-w-xl animate-fade-in font-mono text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-graphite-400 uppercase">Select Target Environment Prefix</label>
                    <select
                      value={selectedBottleId}
                      onChange={(e) => setSelectedBottleId(e.target.value)}
                      className="glass-input py-2 bg-graphite-850 cursor-pointer font-bold text-white"
                    >
                      {bottles.map(b => (
                        <option key={b.id} value={b.id}>{b.name} (Preset: {b.prefix_type.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-[10px] text-graphite-400 leading-relaxed pt-1.5">
                    🚨 <strong>Warning:</strong> Deploying software into an existing bottle will inherit all existing registry entries, DLL overrides, and environment variables defined inside that prefix. Ensure compatibility presets match.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: INSTALLATION LOGS & TELEMETRY PROGRESS */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <span className="text-xs font-bold font-mono uppercase text-white tracking-wide">Deployment Pipeline & System Telemetry</span>
                <p className="text-[11px] text-graphite-400">Please stand by. FusionCross is currently generating the sandbox folders, setting up registry tables, preloading library bindings, and launching installer components.</p>
              </div>

              {/* Progress bar */}
              <div className="glass-panel p-4 rounded-xl border-graphite-800/60 bg-graphite-950/25 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-neon-purple font-bold flex items-center gap-1.5 animate-pulse">
                    <DownloadCloud className="w-4 h-4 text-neon-purple shrink-0" /> INJECTING SYSTEM BLUEPRINT...
                  </span>
                  <span className="text-white font-bold">{downloadProgress[selectedRecipeId || 'winamp'] || 0}%</span>
                </div>
                <div className="w-full bg-graphite-850 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-neon-purple to-neon-indigo h-full rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress[selectedRecipeId || 'winamp'] || 0}%` }}
                  />
                </div>
              </div>

              {/* Telemetry output logs console */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold font-mono text-graphite-400 uppercase">Wine Output logs stream</span>
                <div className="bg-black/80 rounded-xl p-4 border border-graphite-850 h-[160px] overflow-y-auto font-mono text-[10px] text-neon-purple space-y-1 scrollbar-thin">
                  {logs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed border-l-2 border-neon-purple/35 pl-2 py-0.2 select-text">{log}</div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-graphite-500 italic">Preloading sandbox components, awaiting pipeline signals...</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE & SUCCESS */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center text-neon-green shadow-[0_0_20px_rgba(82,183,136,0.15)] scale-110">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wide">Application Deployed Successfully!</h3>
                <p className="text-xs text-graphite-400 leading-relaxed font-mono">
                  '{selectedRecipeId === 'custom' ? customAppName : selectedRecipe?.name}' is now fully installed and registered within your <strong>{bottleMode === 'new' ? newBottleName : 'Existing prefix'}</strong> sandbox environment. All translation presets are bound.
                </p>
              </div>

              <div className="glass-panel p-4 rounded-xl border-graphite-800 bg-graphite-950/20 text-[10px] font-mono text-graphite-400 grid grid-cols-2 gap-4 max-w-sm">
                <div className="flex flex-col items-start gap-1">
                  <span>WINE VERSION</span>
                  <strong className="text-white">{bottleMode === 'new' ? newWineVersion : 'Default'}</strong>
                </div>
                <div className="flex flex-col items-start gap-1">
                  <span>BOTTLE PRESCRIPTION</span>
                  <strong className="text-neon-purple uppercase">{bottleMode === 'new' ? newBottleType : 'Active'}</strong>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-graphite-800/40 bg-graphite-950/60 flex justify-between items-center gap-3">
          {step > 1 && step < 3 && !isInstalling ? (
            <button
              onClick={handlePrevStep}
              className="btn-secondary py-1.5 px-4 text-xs font-mono flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> PREVIOUS
            </button>
          ) : <div />}

          <div className="flex gap-2">
            {step < 2 ? (
              <button
                onClick={handleNextStep}
                disabled={!selectedRecipeId}
                className={`btn-primary py-1.5 px-5 text-xs font-mono flex items-center gap-1.5 ${
                  !selectedRecipeId ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                CONTINUE <ArrowRight className="w-4 h-4" />
              </button>
            ) : step === 2 ? (
              <button
                onClick={startInstallation}
                disabled={bottleMode === 'new' && !newBottleName.trim()}
                className={`btn-primary py-1.5 px-6 text-xs font-mono flex items-center gap-1.5 ${
                  bottleMode === 'new' && !newBottleName.trim() ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                INSTALL <DownloadCloud className="w-4 h-4 animate-bounce" />
              </button>
            ) : step === 4 ? (
              <button
                onClick={handleClose}
                className="btn-primary py-2 px-6 text-xs font-mono flex items-center gap-1"
              >
                LAUNCH & CLOSE <Check className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};

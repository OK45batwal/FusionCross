import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { AppConfig } from '../types';
import { 
  Search, 
  Heart, 
  Play, 
  PlusCircle, 
  FolderOpen, 
  Tag, 
  SlidersHorizontal,
  X,
  FileCode,
  Upload,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  CheckCircle2
} from 'lucide-react';
import { RunCommandModal } from '../components/RunCommandModal';

export const Library: React.FC = () => {
  const { 
    apps, 
    bottles, 
    launchApp, 
    toggleFavorite, 
    registerApp, 
    activeAppId,
    setShowWizard,
    runCustomExe,
    logs,
    clearLogs,
    rosettaDiagnostics,
    fetchRosettaStatus
  } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    fetchRosettaStatus();
  }, []);
  
  // Installer Modal State
  const [showInstaller, setShowInstaller] = useState<boolean>(false);
  const [installStep, setInstallStep] = useState<number>(0);
  const [newAppName, setNewAppName] = useState<string>('');
  const [newExePath, setNewExePath] = useState<string>('');
  const [newArgs, setNewArgs] = useState<string>('');
  const [selectedBottleId, setSelectedBottleId] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Games');
  const [newTagInput, setNewTagInput] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Run Custom Command Modal State
  const [showRunCommand, setShowRunCommand] = useState<boolean>(false);
  const [isRunningCommand, setIsRunningCommand] = useState<boolean>(false);
  const [runComplete, setRunComplete] = useState<boolean>(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.exe') || file.name.endsWith('.msi')) {
        setNewExePath(`C:\\Program Files\\${file.name}`);
        setNewAppName(file.name.replace(/\.[^/.]+$/, ""));
        setInstallStep(1); // advance to configuration
      }
    }
  };

  const selectMockFile = (name: string, path: string) => {
    setNewAppName(name);
    setNewExePath(path);
    setInstallStep(1);
  };

  const addTag = () => {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const removeTag = (indexToRemove: number) => {
    setTags(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleInstall = async () => {
    const finalBottleId = selectedBottleId || (bottles.length > 0 ? bottles[0].id : 'bottle-gaming');
    await registerApp(newAppName, newExePath, newArgs, finalBottleId, newCategory, tags);
    
    // Reset state
    setShowInstaller(false);
    setInstallStep(0);
    setNewAppName('');
    setNewExePath('');
    setNewArgs('');
    setTags([]);
  };

  const handleRunCommand = async (bottleId: string, exePath: string, args: string) => {
    setIsRunningCommand(true);
    setRunComplete(false);
    clearLogs();

    try {
      await runCustomExe(bottleId, exePath, args);
      setRunComplete(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningCommand(false);
    }
  };

  // Filtered Apps list
  const filteredApps = apps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = 
      activeCategory === 'all' || 
      (activeCategory === 'favorites' && app.favorite) ||
      app.category.toLowerCase() === activeCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 h-full bg-graphite-900/40 relative">
      <div className="h-4 select-none pointer-events-none" />

      {/* Warning Banners */}
      {rosettaDiagnostics.is_apple_silicon && !rosettaDiagnostics.rosetta_installed && (
        <div className="glass-panel p-4 rounded-2xl border-neon-purple/35 bg-gradient-to-r from-neon-purple/10 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-[0_0_15px_rgba(157,78,221,0.08)] font-mono text-xs">
          <div className="flex gap-3">
            <div className="p-2 bg-neon-purple/10 border border-neon-purple/20 rounded-xl text-neon-purple shrink-0 mt-0.5 md:mt-0">
              <Cpu className="w-5 h-5 animate-pulse-subtle" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                Rosetta 2 Translation Subsystem Missing
              </div>
              <p className="text-[10px] text-graphite-400 leading-normal max-w-xl">
                To run Windows x86_64 binaries on Apple Silicon M-series chips, you must bootstrap Apple&apos;s Rosetta 2 environment translator layer.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText("softwareupdate --install-rosetta --agree-to-license");
            }}
            className="btn-secondary py-1.5 px-4 text-[10px] font-mono font-bold flex items-center gap-1.5 border-neon-purple/35 text-neon-purple hover:bg-neon-purple/5 shrink-0 rounded-lg cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Copy Install Command</span>
          </button>
        </div>
      )}

      {!rosettaDiagnostics.wine_installed && (
        <div className="glass-panel p-4 rounded-2xl border-neon-indigo/35 bg-gradient-to-r from-neon-indigo/10 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-[0_0_15px_rgba(99,102,241,0.08)] font-mono text-xs">
          <div className="flex gap-3">
            <div className="p-2 bg-neon-indigo/10 border border-neon-indigo/20 rounded-xl text-neon-indigo shrink-0 mt-0.5 md:mt-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
                Wine Translation Binary Missing
              </div>
              <p className="text-[10px] text-graphite-400 leading-normal max-w-xl">
                FusionCross runs WINE wrappers underneath to translate Windows API calls natively. We detected that standard WINE staging binaries are missing on this system.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText("brew install --cask --no-quarantine wine-stable");
            }}
            className="btn-secondary py-1.5 px-4 text-[10px] font-mono font-bold flex items-center gap-1.5 border-neon-indigo/35 text-neon-indigo hover:bg-neon-indigo/5 shrink-0 rounded-lg cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Copy Homebrew Command</span>
          </button>
        </div>
      )}

      {/* Header bar controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-graphite-800/40 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-neon-indigo" /> App Library
          </h1>
          <p className="text-xs text-graphite-400 font-mono">
            Access, launch, and manage your isolated Windows applications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-graphite-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input pl-10 w-full"
            />
          </div>

          {/* Run Custom Command Button */}
          <button 
            onClick={() => setShowRunCommand(true)}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Terminal className="w-4.5 h-4.5" />
            <span>Run Command...</span>
          </button>

          {/* Add App Button */}
          <button 
            onClick={() => setShowWizard(true)}
            className="btn-primary flex items-center gap-1.5"
          >
            <PlusCircle className="w-4.5 h-4.5" />
            <span>Install App</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 border-b border-graphite-800/20 pb-4">
        {['all', 'games', 'productivity', 'favorites'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveCategory(tab)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold transition-all uppercase tracking-wider ${
              activeCategory === tab 
                ? 'bg-neon-indigo/15 border border-neon-indigo/30 text-white' 
                : 'text-graphite-400 hover:text-graphite-200 hover:bg-graphite-800/30 border border-transparent'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Grid Library View */}
      {filteredApps.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {filteredApps.map((app) => {
            const bottle = bottles.find(b => b.id === app.bottle_id);
            return (
              <div 
                key={app.id} 
                className="glass-panel rounded-2xl overflow-hidden border-graphite-800/80 hover:border-neon-indigo/35 transition-all duration-300 flex flex-col group shadow-md"
              >
                {/* Visual Cover Art Container */}
                <div className="relative aspect-[3/4] bg-gradient-to-b from-graphite-800 to-graphite-950 flex items-center justify-center border-b border-graphite-800 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-graphite-950 via-transparent to-transparent opacity-75 z-10" />
                  
                  {/* Neon Glowing Background behind labels */}
                  <div className="absolute w-24 h-24 bg-neon-indigo/10 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500" />
                  
                  {/* Floating Action Overlay */}
                  <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 backdrop-blur-sm bg-graphite-950/40 transition-all duration-300">
                    <button 
                      onClick={() => launchApp(app.id)}
                      disabled={activeAppId !== null}
                      className="p-3 bg-neon-indigo hover:bg-neon-indigo/90 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50"
                      title="Launch Executable"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                    <button 
                      onClick={() => toggleFavorite(app.id)}
                      className={`p-3 border rounded-xl active:scale-95 transition-all ${
                        app.favorite 
                          ? 'bg-neon-pink/15 text-neon-pink border-neon-pink/30 hover:bg-neon-pink hover:text-white' 
                          : 'bg-graphite-800/80 text-graphite-300 border-graphite-700 hover:text-white'
                      }`}
                      title={app.favorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Heart className={`w-5 h-5 ${app.favorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Character Avatar/Art representation */}
                  <div className="font-bold font-mono text-4xl text-graphite-700 group-hover:scale-105 group-hover:text-neon-indigo transition-all duration-500">
                    {app.icon === 'steam' && <span className="text-neon-indigo">STEAM</span>}
                    {app.icon === 'cyberpunk' && <span className="text-neon-pink">C77</span>}
                    {app.icon === 'office' && <span className="text-neon-blue">WORD</span>}
                    {app.icon === 'generic' && <span className="text-graphite-500">EXE</span>}
                  </div>

                  {/* Tags */}
                  <div className="absolute bottom-3 left-3 z-20 flex flex-wrap gap-1 max-w-[80%]">
                    {app.tags.slice(0, 2).map((t, i) => (
                      <span key={i} className="text-[9px] font-semibold font-mono tracking-wider bg-graphite-900/90 text-graphite-300 px-1.5 py-0.5 rounded border border-graphite-800">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white leading-tight group-hover:text-neon-indigo transition-colors truncate">
                      {app.name}
                    </h3>
                    <div className="flex justify-between items-center text-[10px] font-mono text-graphite-400">
                      <span>Prefix: <strong className="text-graphite-300">{bottle?.name.split(' ')[0] || 'Gaming'}</strong></span>
                      <span>{(app.play_time_mins / 60).toFixed(0)} Hours</span>
                    </div>
                  </div>

                  {/* Environment indicator */}
                  <div className="pt-2 border-t border-graphite-800/40 flex justify-between items-center text-[9px] text-graphite-500 font-mono">
                    <span className="bg-graphite-800 text-graphite-300 px-2 py-0.5 rounded uppercase font-semibold">
                      {app.category}
                    </span>
                    <span>W64</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-16 text-center text-graphite-400 text-sm rounded-2xl border-graphite-800 max-w-xl mx-auto space-y-4">
          <FolderOpen className="w-12 h-12 text-graphite-600 mx-auto" />
          <div className="space-y-1">
            <span className="font-bold text-white">No applications match filter</span>
            <p className="text-xs text-graphite-500">Try adjusting your search criteria or drag in a Windows .exe application to register a new one!</p>
          </div>
          <button 
            onClick={() => setShowWizard(true)}
            className="btn-secondary mx-auto mt-2"
          >
            Start Installer Wizard
          </button>
        </div>
      )}

      {/* DRAG AND DROP INSTALLER MODAL */}
      {showInstaller && (
        <div className="fixed inset-0 z-40 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel-glow w-full max-w-lg rounded-2xl overflow-hidden border-neon-indigo/20 flex flex-col h-[520px] relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-graphite-800/40">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-neon-indigo" />
                <span className="font-bold text-white font-mono text-sm uppercase">FusionCross Installer Wizard</span>
              </div>
              <button 
                onClick={() => { setShowInstaller(false); setInstallStep(0); }}
                className="p-1 hover:bg-graphite-800 rounded-lg text-graphite-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Steps Content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {installStep === 0 ? (
                /* STEP 0: Drag EXE File or Select Mock Preset */
                <div className="space-y-6 h-full flex flex-col justify-center">
                  <div className="text-center space-y-1.5">
                    <h2 className="text-lg font-bold text-white font-mono">Select Windows Executable</h2>
                    <p className="text-xs text-graphite-400 max-w-sm mx-auto">
                      Drag and drop your Windows setup `.exe` or executable directory to install into a custom Wine prefix.
                    </p>
                  </div>

                  {/* Drag Zone */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 transition-all duration-200 ${
                      dragActive 
                        ? 'border-neon-indigo bg-neon-indigo/5 scale-[0.99]' 
                        : 'border-graphite-700/60 bg-graphite-900/20 hover:border-graphite-600'
                    }`}
                  >
                    <Upload className={`w-8 h-8 mb-3 transition-transform ${dragActive ? 'text-neon-indigo scale-110 animate-bounce' : 'text-graphite-500'}`} />
                    <span className="text-xs font-semibold text-graphite-200">Drag EXE or MSI Here</span>
                    <span className="text-[10px] text-graphite-500 mt-1">Supports file types: .exe, .msi</span>
                  </div>

                  {/* Preset Shortcuts for Demo */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-graphite-400 uppercase tracking-wider font-mono font-bold">Quick Preset Examples</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button 
                        onClick={() => selectMockFile("Witcher 3", "C:\\GOG Games\\The Witcher 3\\bin\\x64\\witcher3.exe")}
                        className="p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-neon-indigo/50 text-left text-graphite-200 hover:text-white"
                      >
                        ⚔️ The Witcher 3 Setup
                      </button>
                      <button 
                        onClick={() => selectMockFile("Adobe Photoshop", "C:\\Program Files\\Adobe\\Photoshop\\Photoshop.exe")}
                        className="p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-neon-indigo/50 text-left text-graphite-200 hover:text-white"
                      >
                        🎨 Adobe Photoshop
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* STEP 1: Application Configurations */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-neon-indigo/10 border border-neon-indigo/25 p-3 rounded-xl">
                    <FileCode className="w-8 h-8 text-neon-indigo" />
                    <div>
                      <span className="text-xs text-graphite-400 font-mono">Selected File Target</span>
                      <p className="text-xs font-bold text-white font-mono truncate max-w-xs">{newExePath.split('\\').pop()}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {/* App Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Application Name</label>
                      <input 
                        type="text" 
                        value={newAppName}
                        onChange={(e) => setNewAppName(e.target.value)}
                        className="glass-input"
                        placeholder="e.g. Witcher 3"
                      />
                    </div>

                    {/* Exe Target Directory */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Executable Destination</label>
                      <input 
                        type="text" 
                        value={newExePath}
                        onChange={(e) => setNewExePath(e.target.value)}
                        className="glass-input font-mono"
                      />
                    </div>

                    {/* Exe Launch Arguments */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Arguments (Optional)</label>
                      <input 
                        type="text" 
                        value={newArgs}
                        onChange={(e) => setNewArgs(e.target.value)}
                        className="glass-input font-mono"
                        placeholder="e.g. -windowed -nofriendsui"
                      />
                    </div>

                    {/* Split Row: Bottle Target and Category */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Select Bottle prefix target */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Wine Prefix/Bottle</label>
                        <select 
                          value={selectedBottleId}
                          onChange={(e) => setSelectedBottleId(e.target.value)}
                          className="glass-input bg-graphite-800 cursor-pointer"
                        >
                          <option value="">Select Bottle Prefix</option>
                          {bottles.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Select Category */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Category</label>
                        <select 
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="glass-input bg-graphite-800 cursor-pointer"
                        >
                          <option value="Games">Games</option>
                          <option value="Productivity">Productivity</option>
                          <option value="Utilities">Utilities</option>
                        </select>
                      </div>
                    </div>

                    {/* Tags input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Tags</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          className="glass-input flex-1"
                          placeholder="e.g. RPG, Sandbox"
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        />
                        <button 
                          onClick={addTag}
                          className="btn-secondary px-4"
                        >
                          Add
                        </button>
                      </div>

                      {/* Display added tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {tags.map((t, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[10px] font-mono font-semibold tracking-wider bg-graphite-800 border border-graphite-700/60 px-2 py-0.5 rounded text-graphite-300">
                            {t}
                            <button onClick={() => removeTag(idx)} className="text-red-500 hover:text-red-400 ml-1">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-graphite-800/40 bg-graphite-950/40 flex items-center justify-between">
              {installStep === 1 && (
                <button
                  onClick={() => setInstallStep(0)}
                  className="text-xs font-semibold text-graphite-400 hover:text-white font-mono uppercase transition-colors"
                >
                  Back
                </button>
              )}
              <div className="ml-auto flex gap-3">
                <button 
                  onClick={() => { setShowInstaller(false); setInstallStep(0); }}
                  className="btn-secondary py-2"
                >
                  Cancel
                </button>
                {installStep === 1 && (
                  <button 
                    onClick={handleInstall}
                    className="btn-primary py-2"
                  >
                    <Sparkles className="w-4 h-4" /> Install Application
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <RunCommandModal
        isOpen={showRunCommand}
        onClose={() => { setShowRunCommand(false); setRunComplete(false); }}
        bottles={bottles}
        onRun={handleRunCommand}
        accentColor="indigo"
        logs={logs}
        isRunning={isRunningCommand}
        isComplete={runComplete}
      />
    </div>
  );
};

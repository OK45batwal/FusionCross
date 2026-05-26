import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { Bottle, DllOverride, RegistryKey, DiscoveredApp } from '../types';
import { 
  Layers, 
  Trash2, 
  Copy, 
  PlusCircle, 
  Wrench, 
  Variable, 
  Sliders, 
  Database,
  Cpu,
  CheckCircle2,
  FileCode,
  X,
  Plus,
  Terminal,
  FolderOpen,
  RefreshCw,
  Search,
  Download,
  Check
} from 'lucide-react';

export const BottleManager: React.FC = () => {
  const { 
    bottles, 
    createBottle, 
    removeBottle, 
    duplicateBottle, 
    updateBottle, 
    runtimes,
    runCustomExe,
    logs,
    clearLogs,
    openPrefixInFinder,
    resetSandbox,
    installDependencies,
    installDxvk,
    backupBottle,
    scanApps,
    apps,
    registerApp,
    downloadProgress
  } = useApp();

  const [selectedId, setSelectedId] = useState<string>(bottles[0]?.id || '');
  const [activeSubTab, setActiveSubTab] = useState<'overrides' | 'env' | 'registry' | 'graphics' | 'dependencies' | 'scanner' | 'backups'>('overrides');

  // Creation State
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<string>('gaming');
  const [newWineVersion, setNewWineVersion] = useState<string>('Proton GE 9.0');

  // DLL Overrides additions
  const [newLibName, setNewLibName] = useState<string>('');
  const [newLibType, setNewLibType] = useState<string>('native,builtin');

  // Environment variables additions
  const [newEnvKey, setNewEnvKey] = useState<string>('');
  const [newEnvVal, setNewEnvVal] = useState<string>('');

  // Registry Editor additions
  const [newRegPath, setNewRegPath] = useState<string>('HKCU\\Software\\Wine\\Direct3D');
  const [newRegKey, setNewRegKey] = useState<string>('');
  const [newRegVal, setNewRegVal] = useState<string>('');
  const [newRegType, setNewRegType] = useState<string>('SZ');

  // Run Custom Command State
  const [showRunCommand, setShowRunCommand] = useState<boolean>(false);
  const [runExePath, setRunExePath] = useState<string>('');
  const [runArgs, setRunArgs] = useState<string>('');
  const [isRunningCommand, setIsRunningCommand] = useState<boolean>(false);
  const [runComplete, setRunComplete] = useState<boolean>(false);

  // App Scanner State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannedApps, setScannedApps] = useState<DiscoveredApp[]>([]);

  // Backup State
  const [backupPath, setBackupPath] = useState<string>('');
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupMessage, setBackupMessage] = useState<string>( '');

  const selectedBottle = bottles.find(b => b.id === selectedId) || bottles[0];

  useEffect(() => {
    if (selectedBottle) {
      setBackupPath(`/Users/omkar/Desktop/${selectedBottle.name.toLowerCase().replace(/\s+/g, '_')}_backup.tar.gz`);
      setBackupMessage('');
      setScannedApps([]);
    }
  }, [selectedId, selectedBottle]);

  const handleCreate = async () => {
    if (newName.trim()) {
      await createBottle(newName, newType, newWineVersion);
      setShowCreator(false);
      setNewName('');
    }
  };

  const handleAddOverride = () => {
    if (newLibName.trim() && selectedBottle) {
      const overrides = [...selectedBottle.dll_overrides];
      if (!overrides.some(o => o.library.toLowerCase() === newLibName.toLowerCase())) {
        overrides.push({ library: newLibName, override_type: newLibType });
        updateBottle({ ...selectedBottle, dll_overrides: overrides });
      }
      setNewLibName('');
    }
  };

  const handleRemoveOverride = (lib: string) => {
    if (selectedBottle) {
      const overrides = selectedBottle.dll_overrides.filter(o => o.library !== lib);
      updateBottle({ ...selectedBottle, dll_overrides: overrides });
    }
  };

  const handleAddEnv = () => {
    if (newEnvKey.trim() && selectedBottle) {
      const env = { ...selectedBottle.env_vars };
      env[newEnvKey.trim()] = newEnvVal.trim();
      updateBottle({ ...selectedBottle, env_vars: env });
      setNewEnvKey('');
      setNewEnvVal('');
    }
  };

  const handleRemoveEnv = (key: string) => {
    if (selectedBottle) {
      const env = { ...selectedBottle.env_vars };
      delete env[key];
      updateBottle({ ...selectedBottle, env_vars: env });
    }
  };

  const handleAddRegistry = () => {
    if (newRegKey.trim() && selectedBottle) {
      const keys = [...selectedBottle.registry_keys];
      if (!keys.some(k => k.path === newRegPath && k.key === newRegKey)) {
        keys.push({
          path: newRegPath,
          key: newRegKey,
          value: newRegVal,
          value_type: newRegType
        });
        updateBottle({ ...selectedBottle, registry_keys: keys });
      }
      setNewRegKey('');
      setNewRegVal('');
    }
  };

  const handleRemoveRegistry = (path: string, key: string) => {
    if (selectedBottle) {
      const keys = selectedBottle.registry_keys.filter(k => !(k.path === path && k.key === key));
      updateBottle({ ...selectedBottle, registry_keys: keys });
    }
  };

  const toggleGraphicsToggles = (type: 'dxvk' | 'moltenvk') => {
    if (selectedBottle) {
      if (type === 'dxvk') {
        updateBottle({ ...selectedBottle, dxvk_enabled: !selectedBottle.dxvk_enabled });
      } else {
        updateBottle({ ...selectedBottle, moltenvk_enabled: !selectedBottle.moltenvk_enabled });
      }
    }
  };

  const handleClone = async () => {
    if (selectedBottle) {
      await duplicateBottle(selectedBottle.id, `${selectedBottle.name} (Copy)`);
    }
  };

  const handleDelete = async () => {
    if (selectedBottle) {
      const confirmed = window.confirm(`Are you sure you want to delete the bottle "${selectedBottle.name}" and all its applications?`);
      if (confirmed) {
        const nextId = bottles.find(b => b.id !== selectedBottle.id)?.id || '';
        await removeBottle(selectedBottle.id);
        setSelectedId(nextId);
      }
    }
  };

  const handleRunCommand = async () => {
    if (!runExePath.trim() || !selectedBottle) return;
    setIsRunningCommand(true);
    setRunComplete(false);
    clearLogs();
    
    try {
      await runCustomExe(selectedBottle.id, runExePath, runArgs);
      setRunComplete(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningCommand(false);
    }
  };

  const handleScanApps = async () => {
    if (!selectedBottle) return;
    setIsScanning(true);
    try {
      const res = await scanApps(selectedBottle.id);
      setScannedApps(res);
    } catch (err) {
      console.error("Scanner failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleRegisterScannedApp = async (scannedApp: DiscoveredApp) => {
    if (!selectedBottle) return;
    try {
      await registerApp(
        scannedApp.name,
        scannedApp.path,
        "",
        selectedBottle.id,
        "Games",
        ["Scanned", "Local"]
      );
      alert(`Successfully registered '${scannedApp.name}' in library!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateBackup = async () => {
    if (!selectedBottle || !backupPath.trim()) return;
    setIsBackingUp(true);
    setBackupMessage('');
    try {
      const res = await backupBottle(selectedBottle.id, backupPath.trim());
      setBackupMessage(res);
    } catch (err: any) {
      setBackupMessage(`Backup failed: ${err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const activeRuntimes = runtimes.filter(r => r.downloaded && (r.category === 'wine' || r.category === 'proton'));

  return (
    <div className="flex-1 flex overflow-hidden h-full bg-graphite-900/40 relative">
      <div className="h-4 select-none pointer-events-none absolute top-0" />

      {/* 1. Left Side Bottle Selector List */}
      <div className="w-80 border-r border-graphite-800/80 bg-graphite-900/25 flex flex-col pt-12">
        <div className="p-4 border-b border-graphite-800/40 flex items-center justify-between">
          <span className="text-xs uppercase font-mono tracking-wider font-bold text-graphite-400">Bottles Directory</span>
          <button 
            onClick={() => setShowCreator(true)}
            className="p-1.5 bg-neon-purple/10 border border-neon-purple/35 rounded-lg text-neon-purple hover:bg-neon-purple hover:text-white transition-all scale-105 active:scale-95"
            title="Create New Bottle"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {bottles.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 ${
                selectedId === b.id 
                  ? 'bg-gradient-to-r from-neon-purple/15 to-neon-indigo/5 border-neon-purple/40 shadow-neon-purple/5' 
                  : 'bg-graphite-900/20 border-graphite-850 hover:bg-graphite-800/20 hover:border-graphite-700/60'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex justify-between items-center pr-1">
                  <span className="text-sm font-bold text-white truncate max-w-[80%]">{b.name}</span>
                  <span className={`w-2 h-2 rounded-full ${b.dxvk_enabled ? 'bg-neon-purple shadow-[0_0_6px_rgba(157,78,221,0.6)]' : 'bg-graphite-650'}`} />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-graphite-400">
                  <span className="bg-graphite-800 px-1.5 py-0.5 rounded border border-graphite-700/30 uppercase">{b.prefix_type}</span>
                  <span>{(b.size_bytes / 1_000_000).toFixed(0)} MB</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Right Side Details Panel */}
      {selectedBottle ? (
        <div className="flex-1 flex flex-col pt-12 overflow-hidden">
          {/* Details header */}
          <div className="p-6 border-b border-graphite-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-graphite-950/20">
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-white tracking-tight font-mono">{selectedBottle.name}</h1>
              <div className="flex items-center gap-3 text-xs text-graphite-400 font-mono">
                <span>Created: <strong>{selectedBottle.created_at}</strong></span>
                <span>•</span>
                <span>Runtime: <strong className="text-neon-purple">{selectedBottle.wine_version}</strong></span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setShowRunCommand(true)}
                className="btn-primary py-2 text-xs font-mono flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5" /> RUN COMMAND
              </button>
              <button 
                onClick={handleClone}
                className="btn-secondary py-2 text-xs font-mono"
              >
                <Copy className="w-3.5 h-3.5" /> CLONE
              </button>
              <button 
                onClick={handleDelete}
                className="btn-danger py-2 text-xs font-mono"
              >
                <Trash2 className="w-3.5 h-3.5" /> DELETE
              </button>
              <button 
                onClick={() => openPrefixInFinder(selectedBottle.path)}
                className="btn-secondary py-2 text-xs font-mono"
                title="Open WinePrefix folder in Finder"
              >
                <FolderOpen className="w-3.5 h-3.5" /> SHOW ON DISK
              </button>
            </div>
          </div>

          {/* Prefix Path Display */}
          <div className="px-6 py-2.5 border-b border-graphite-800/40 bg-graphite-950/30 flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-graphite-500 shrink-0" />
            <span className="text-[10px] font-mono text-graphite-400 truncate" title={selectedBottle.path}>
              Sandbox prefix: <strong className="text-graphite-300">{selectedBottle.path}</strong>
            </span>
          </div>

          {/* Sub-tabs buttons */}
          <div className="flex border-b border-graphite-800/40 px-6 bg-graphite-950/25 overflow-x-auto select-none no-scrollbar">
            {[
              { id: 'overrides', name: 'DLL Overrides', icon: Sliders },
              { id: 'env', name: 'Environment', icon: Variable },
              { id: 'registry', name: 'Registry Keys', icon: Database },
              { id: 'graphics', name: 'GPU Config', icon: Cpu },
              { id: 'dependencies', name: 'Winetricks', icon: Wrench },
              { id: 'scanner', name: 'App Scanner', icon: Search },
              { id: 'backups', name: 'Backups', icon: Download },
            ].map((sub) => {
              const Icon = sub.icon;
              const isSubActive = activeSubTab === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id as any)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-xs font-semibold font-mono border-b-2 shrink-0 transition-all ${
                    isSubActive 
                      ? 'border-neon-purple text-white bg-neon-purple/5' 
                      : 'border-transparent text-graphite-400 hover:text-graphite-250 hover:bg-graphite-800/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{sub.name}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Configuration Panel Views */}
          <div className="flex-1 overflow-y-auto p-6 bg-graphite-900/20">
            {activeSubTab === 'overrides' ? (
              /* A. DLL OVERRIDES VIEW */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Wine DLL Overrides</h2>
                  <p className="text-xs text-graphite-400">Configure custom library bindings for graphics plugins, translation plugins, or customized win32 system wrappers.</p>
                </div>

                {/* Add override tool */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-3 border-graphite-800 max-w-2xl bg-graphite-950/20">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Library DLL Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. d3d11, dxgi, openal"
                      value={newLibName}
                      onChange={(e) => setNewLibName(e.target.value)}
                      className="glass-input py-1.5 font-mono"
                    />
                  </div>
                  <div className="w-48 flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Binding Type</label>
                    <select 
                      value={newLibType}
                      onChange={(e) => setNewLibType(e.target.value)}
                      className="glass-input py-1.5 bg-graphite-800 cursor-pointer"
                    >
                      <option value="native,builtin">native, builtin</option>
                      <option value="builtin,native">builtin, native</option>
                      <option value="native">native only</option>
                      <option value="builtin">builtin only</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleAddOverride}
                    className="btn-primary self-end py-2 px-4"
                  >
                    Add Override
                  </button>
                </div>

                {/* Overrides list table */}
                <div className="glass-panel rounded-xl overflow-hidden border-graphite-800 max-w-2xl">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-graphite-950/60 text-graphite-400 border-b border-graphite-800/40">
                      <tr>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">DLL Library</th>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Execution Preference</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-850">
                      {selectedBottle.dll_overrides.map((override, idx) => (
                        <tr key={idx} className="hover:bg-graphite-800/20 text-graphite-200">
                          <td className="p-3.5 font-bold text-white">{override.library}</td>
                          <td className="p-3.5">
                            <span className="bg-neon-purple/10 text-neon-purple border border-neon-purple/20 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                              {override.override_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <button 
                              onClick={() => handleRemoveOverride(override.library)}
                              className="text-red-500 hover:text-red-400 hover:scale-105 active:scale-95 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {selectedBottle.dll_overrides.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-graphite-400">No overrides active.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeSubTab === 'env' ? (
              /* B. ENVIRONMENT VARIABLES VIEW */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Environment Variables</h2>
                  <p className="text-xs text-graphite-400">Define runtime overrides, rendering telemetry, multi-threading switches, and execution flags.</p>
                </div>

                {/* Add variable panel */}
                <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row gap-3 border-graphite-800 max-w-2xl bg-graphite-950/20">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Variable Key</label>
                    <input 
                      type="text" 
                      placeholder="e.g. WINEESYNC, DXVK_HUD"
                      value={newEnvKey}
                      onChange={(e) => setNewEnvKey(e.target.value)}
                      className="glass-input py-1.5 font-mono"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Variable Value</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1, fps, compiler"
                      value={newEnvVal}
                      onChange={(e) => setNewEnvVal(e.target.value)}
                      className="glass-input py-1.5 font-mono"
                    />
                  </div>
                  <button 
                    onClick={handleAddEnv}
                    className="btn-primary self-end py-2 px-4"
                  >
                    Add Variable
                  </button>
                </div>

                {/* Env list table */}
                <div className="glass-panel rounded-xl overflow-hidden border-graphite-800 max-w-2xl">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-graphite-950/60 text-graphite-400 border-b border-graphite-800/40">
                      <tr>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Key</th>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Value</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-850">
                      {Object.entries(selectedBottle.env_vars).map(([key, val]) => (
                        <tr key={key} className="hover:bg-graphite-800/20 text-graphite-200">
                          <td className="p-3.5 font-bold text-white">{key}</td>
                          <td className="p-3.5 text-graphite-300">{val}</td>
                          <td className="p-3.5 text-center">
                            <button 
                              onClick={() => handleRemoveEnv(key)}
                              className="text-red-500 hover:text-red-400 hover:scale-105 active:scale-95 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {Object.keys(selectedBottle.env_vars).length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-graphite-400">No environment variables defined.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeSubTab === 'registry' ? (
              /* C. REGISTRY KEY EDITOR VIEW */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Registry Key Editor</h2>
                  <p className="text-xs text-graphite-400">Direct interface to inject virtual Windows registry parameters, Retina toggles, and Direct3D overrides.</p>
                </div>

                {/* Add Registry key Panel */}
                <div className="glass-panel p-4 rounded-2xl space-y-3.5 border-graphite-800 max-w-2xl bg-graphite-950/20">
                  <div className="text-xs font-semibold font-mono text-white border-b border-graphite-850 pb-2 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-neon-purple" /> Add Virtual Registry Entry
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Registry Tree Path</label>
                      <select 
                        value={newRegPath}
                        onChange={(e) => setNewRegPath(e.target.value)}
                        className="glass-input py-1.5 bg-graphite-850 cursor-pointer font-mono"
                      >
                        <option value="HKCU\\Software\\Wine\\Direct3D">HKCU\Software\Wine\Direct3D</option>
                        <option value="HKCU\\Software\\Wine\\Mac Driver">HKCU\Software\Wine\Mac Driver</option>
                        <option value="HKLM\\Software\\Microsoft\\Windows NT">HKLM\Software\Microsoft\Windows NT</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Registry Key Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. MaxShaderModelVS, RetinaMode"
                        value={newRegKey}
                        onChange={(e) => setNewRegKey(e.target.value)}
                        className="glass-input py-1.5 font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3.5 items-end">
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-graphite-400 font-bold uppercase">Value</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 5, Y, win10"
                        value={newRegVal}
                        onChange={(e) => setNewRegVal(e.target.value)}
                        className="glass-input py-1.5 font-mono"
                      />
                    </div>
                    <button 
                      onClick={handleAddRegistry}
                      className="btn-primary py-2 px-4 h-[38px] flex items-center justify-center gap-1.5"
                    >
                      <PlusCircle className="w-4.5 h-4.5" /> Save Key
                    </button>
                  </div>
                </div>

                {/* Keys list table */}
                <div className="glass-panel rounded-xl overflow-hidden border-graphite-800 max-w-2xl">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-graphite-950/60 text-graphite-400 border-b border-graphite-800/40">
                      <tr>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Sub Tree Path</th>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Key</th>
                        <th className="text-left p-3.5 font-bold uppercase tracking-wider">Value</th>
                        <th className="w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-graphite-850">
                      {selectedBottle.registry_keys.map((reg, idx) => (
                        <tr key={idx} className="hover:bg-graphite-800/20 text-graphite-200">
                          <td className="p-3.5 text-graphite-400 truncate max-w-[200px]" title={reg.path}>{reg.path}</td>
                          <td className="p-3.5 font-bold text-white">{reg.key}</td>
                          <td className="p-3.5 text-neon-purple font-semibold">{reg.value}</td>
                          <td className="p-3.5 text-center">
                            <button 
                              onClick={() => handleRemoveRegistry(reg.path, reg.key)}
                              className="text-red-500 hover:text-red-400 hover:scale-105 active:scale-95 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {selectedBottle.registry_keys.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-graphite-400">No custom registry overrides active.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeSubTab === 'graphics' ? (
              /* D. GRAPHICS / GPU CONFIG VIEW */
              <div className="space-y-6 max-w-2xl">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Graphics Adapter & GPU translation</h2>
                  <p className="text-xs text-graphite-400">Toggle translation APIs, Rosetta core parameters, and pipeline compilers to match your hardware structure.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DXVK card */}
                  <div 
                    onClick={() => toggleGraphicsToggles('dxvk')}
                    className={`glass-panel p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-40 ${
                      selectedBottle.dxvk_enabled 
                        ? 'border-neon-purple bg-gradient-to-tr from-neon-purple/10 to-transparent' 
                        : 'border-graphite-800 hover:border-graphite-750 bg-graphite-950/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-white">DXVK Translation Layer</h3>
                        <p className="text-[10px] text-graphite-400 mt-1 leading-relaxed">Converts Windows Direct3D calls (D3D11, D3D10) dynamically into Vulkan execution pipes.</p>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedBottle.dxvk_enabled ? 'bg-neon-purple shadow-[0_0_8px_rgba(157,78,221,1)]' : 'bg-graphite-600'}`} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${selectedBottle.dxvk_enabled ? 'text-neon-purple' : 'text-graphite-500'}`}>
                      {selectedBottle.dxvk_enabled ? 'VULKAN CORE PIPELINES ACTIVE' : 'DIRECT3D FALLBACK'}
                    </span>
                  </div>

                  {/* MoltenVK card */}
                  <div 
                    onClick={() => toggleGraphicsToggles('moltenvk')}
                    className={`glass-panel p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-40 ${
                      selectedBottle.moltenvk_enabled 
                        ? 'border-neon-indigo bg-gradient-to-tr from-neon-indigo/10 to-transparent' 
                        : 'border-graphite-800 hover:border-graphite-750 bg-graphite-950/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-white">MoltenVK Translation Layer</h3>
                        <p className="text-[10px] text-graphite-400 mt-1 leading-relaxed">Translates Vulkan execution nodes directly into native Apple Metal API structures at runtime.</p>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full ${selectedBottle.moltenvk_enabled ? 'bg-neon-indigo shadow-[0_0_8px_rgba(99,102,241,1)]' : 'bg-graphite-600'}`} />
                    </div>
                    <span className={`text-xs font-mono font-bold ${selectedBottle.moltenvk_enabled ? 'text-neon-indigo' : 'text-graphite-500'}`}>
                      {selectedBottle.moltenvk_enabled ? 'APPLE METAL CONVERSION ACTIVE' : 'OPENGL BACKEND'}
                    </span>
                  </div>
                </div>

                {/* Extra parameters panel */}
                <div className="glass-panel p-4 rounded-xl space-y-3.5 border-graphite-800 bg-graphite-950/10 font-mono text-xs">
                  <div className="flex justify-between items-center text-graphite-300">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-neon-indigo" /> Shader Pre-Compilation</span>
                    <span className="font-bold text-white">ENABLED</span>
                  </div>
                  <div className="flex justify-between items-center text-graphite-300">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-neon-indigo" /> Retina HiDPI Display Driver</span>
                    <span className="font-bold text-white">ACTIVE (2x Mode)</span>
                  </div>
                  <div className="pt-2 border-t border-graphite-800/40 flex justify-between items-center text-[10px]">
                    <span className="text-graphite-450">MANUALLY FORCE DXVK TRANSLATION LIBRARY:</span>
                    <button
                      onClick={() => installDxvk(selectedBottle.id, "2.3")}
                      className="p-1 px-3 bg-neon-purple/15 text-neon-purple border border-neon-purple/20 hover:bg-neon-purple hover:text-white rounded transition-all font-bold"
                    >
                      FORCE DXVK SETUP
                    </button>
                  </div>
                </div>
              </div>
            ) : activeSubTab === 'dependencies' ? (
              /* E. WINETRICKS DEPENDENCIES VIEW */
              <div className="space-y-6">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Winetricks Dependencies Manager</h2>
                  <p className="text-xs text-graphite-400">Install essential runtimes, SDK compilers, and DirectX frameworks inside the WINEPREFIX sandbox.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  {[
                    { verb: 'dotnet48', name: '.NET Framework 4.8 Runtime', desc: 'Critical framework for modern productivity tools and game launchers.', icon: '⚡' },
                    { verb: 'vcrun2022', name: 'Microsoft Visual C++ 2022', desc: 'Pre-requisite MSVC redistributables for C++ software compilation runtimes.', icon: '📦' },
                    { verb: 'openal', name: 'OpenAL Audio Core', desc: '3D spatial audio compiler wrapper for immersive CoreAudio mapping.', icon: '🔊' },
                    { verb: 'physx', name: 'NVIDIA PhysX Framework', desc: 'Physics compilation layers for legacy and modern gaming environments.', icon: '💥' },
                    { verb: 'dxvk', name: 'DXVK Direct3D-to-Vulkan', desc: 'Manually load latest stable Vulkan shader translating wrappers.', icon: '⚙️' },
                  ].map((dep) => {
                    const progress = downloadProgress[`dep-${dep.verb}`];
                    const isInstallingDep = progress !== undefined && progress < 100;
                    const isCompleted = progress >= 100;

                    return (
                      <div key={dep.verb} className="glass-panel p-4 rounded-xl border-graphite-800 bg-graphite-950/15 flex flex-col justify-between space-y-3">
                        <div className="flex gap-3">
                          <span className="text-2xl mt-0.5">{dep.icon}</span>
                          <div className="space-y-0.5">
                            <h3 className="text-xs font-bold text-white">{dep.name}</h3>
                            <p className="text-[10px] text-graphite-450 leading-relaxed">{dep.desc}</p>
                          </div>
                        </div>

                        {progress !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-mono">
                              <span className="text-neon-purple">{isCompleted ? 'Completed' : 'Installing...'}</span>
                              <span className="text-white">{progress}%</span>
                            </div>
                            <div className="w-full bg-graphite-850 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-neon-purple to-neon-indigo h-full" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        )}

                        <button
                          disabled={isInstallingDep || isCompleted}
                          onClick={() => installDependencies(selectedBottle.id, dep.verb)}
                          className={`btn-secondary py-1 text-[10px] font-mono font-bold uppercase tracking-wider self-end ${
                            isCompleted ? 'border-neon-green/45 text-neon-green bg-neon-green/5' : ''
                          }`}
                        >
                          {isCompleted ? '✓ INSTALLED' : isInstallingDep ? 'INSTALLING...' : 'INSTALL'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeSubTab === 'scanner' ? (
              /* F. PREFIX APP SCANNER VIEW */
              <div className="space-y-6 max-w-3xl">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Prefix App Scanner</h2>
                  <p className="text-xs text-graphite-400">Scans files recursively inside `drive_c/Program Files` to locate and register unregistered executables instantly.</p>
                </div>

                <div className="flex gap-3 items-center">
                  <button
                    onClick={handleScanApps}
                    disabled={isScanning}
                    className="btn-primary py-2 px-5 text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(157,78,221,0.2)]"
                  >
                    <Search className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'SCANNING SANDBOX...' : 'SCAN FOR EXE APPLICATIONS'}</span>
                  </button>
                  {scannedApps.length > 0 && (
                    <span className="text-[10px] text-graphite-400 font-mono">
                      Discovered {scannedApps.length} executable directories.
                    </span>
                  )}
                </div>

                {scannedApps.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {scannedApps.map((scannedApp, idx) => {
                      const isAlreadyRegistered = apps.some(a => a.exe_path === scannedApp.path && a.bottle_id === selectedBottle.id);
                      return (
                        <div key={idx} className="glass-panel p-4 rounded-xl border-graphite-800 bg-graphite-950/20 flex items-center justify-between hover:border-graphite-700 transition-all">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded bg-graphite-900 border border-graphite-800 flex items-center justify-center font-mono font-bold text-neon-indigo shrink-0">
                              EXE
                            </div>
                            <div className="space-y-0.5 overflow-hidden">
                              <h4 className="text-xs font-bold text-white truncate">{scannedApp.name}</h4>
                              <p className="text-[10px] text-graphite-455 font-mono truncate" title={scannedApp.path}>{scannedApp.path}</p>
                            </div>
                          </div>

                          <button
                            disabled={isAlreadyRegistered}
                            onClick={() => handleRegisterScannedApp(scannedApp)}
                            className={`btn-secondary py-1.5 px-3 text-[10px] font-mono font-bold shrink-0 ${
                              isAlreadyRegistered ? 'opacity-40 cursor-not-allowed border-neon-indigo/30 text-neon-indigo' : 'hover:bg-neon-indigo hover:text-white'
                            }`}
                          >
                            {isAlreadyRegistered ? '✓ ADDED' : 'ADD TO LIBRARY'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !isScanning && (
                    <div className="glass-panel p-8 rounded-xl border-graphite-800/80 bg-graphite-950/10 text-center text-graphite-450 text-xs font-mono">
                      Click the scan button above to run recursive analysis on WINEPREFIX folders.
                    </div>
                  )
                )}
              </div>
            ) : (
              /* G. BACKUP & RESTORE VIEW */
              <div className="space-y-6 max-w-xl">
                <div className="space-y-1">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Prefix Backups & Recovery</h2>
                  <p className="text-xs text-graphite-400">Package and compress your entire isolated WINEPREFIX sandbox as a `.tar.gz` archive for local preservation.</p>
                </div>

                <div className="glass-panel p-5 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/20">
                  <div className="flex flex-col gap-1.5 font-mono text-xs">
                    <label className="text-[10px] font-bold text-graphite-400 uppercase">Export Archive Path</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="e.g. /Users/omkar/Desktop/my_backup.tar.gz"
                        className="glass-input flex-1"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const { invoke } = await import('@tauri-apps/api/core');
                            const defaultName = selectedBottle 
                              ? `${selectedBottle.name.toLowerCase().replace(/\s+/g, '_')}_backup.tar.gz`
                              : 'prefix_backup.tar.gz';
                            const path = await invoke<string>('save_file_picker', {
                              title: 'Choose Backup Archive Location',
                              defaultName
                            });
                            if (path) {
                              setBackupPath(path);
                            }
                          } catch (e) {
                            console.error('Error invoking save_file_picker:', e);
                          }
                        }}
                        className="btn-secondary py-1.5 px-3 text-[10px] font-mono font-bold flex items-center gap-1.5 border-graphite-750 hover:border-graphite-600 bg-graphite-900 hover:bg-graphite-850 rounded-lg cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Choose...</span>
                      </button>
                    </div>
                    <span className="text-[9px] text-graphite-500 leading-normal">
                      Must resolve within your primary user directory partition due to macOS container restrictions.
                    </span>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      onClick={handleGenerateBackup}
                      disabled={isBackingUp || !backupPath.trim()}
                      className="btn-primary py-2 px-5 text-xs font-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(157,78,221,0.2)]"
                    >
                      <Download className={`w-4 h-4 ${isBackingUp ? 'animate-spin' : ''}`} />
                      <span>{isBackingUp ? 'COMPRESSING...' : 'EXPORT BACKUP ARCHIVE'}</span>
                    </button>
                  </div>
                </div>

                {backupMessage && (
                  <div className="flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 p-3 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0" />
                    <div className="text-[10px] font-mono text-graphite-250 leading-relaxed select-text">
                      {backupMessage}
                    </div>
                  </div>
                )}

                {/* Hard Reset Card */}
                <div className="glass-panel p-5 rounded-2xl border-red-900/40 bg-red-950/5 space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-xs font-bold font-mono uppercase text-red-400 flex items-center gap-1.5">
                      ⚠️ DANGER ZONE: Hard Reset Sandbox
                    </span>
                    <p className="text-[10px] text-graphite-400 leading-relaxed">
                      Wipe and recreate a completely fresh empty WINEPREFIX sandbox from scratch. This action will permanently delete all installed programs and registry configurations within this bottle prefix.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const confirmed = window.confirm(`Reset the sandbox for "${selectedBottle.name}"? This will wipe all installed programs and registry changes inside this bottle and recreate a fresh environment.`);
                      if (confirmed) resetSandbox(selectedBottle.id, selectedBottle.path);
                    }}
                    className="btn-danger py-2 px-4 text-xs font-mono self-start"
                  >
                    RESET PREFIX SANDBOX
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-12 text-center text-graphite-400 text-sm font-mono pt-12">
          No bottles available. Click the add icon to create a new prefix bottle.
        </div>
      )}

      {/* CREATE BOTTLE MODAL WIZARD */}
      {showCreator && (
        <div className="fixed inset-0 z-40 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel-glow w-full max-w-sm rounded-2xl overflow-hidden border-neon-purple/20 flex flex-col relative">
            
            {/* Creator Header */}
            <div className="flex items-center justify-between p-5 border-b border-graphite-800/40">
              <span className="font-bold text-white font-mono text-sm uppercase">Create Wine prefix</span>
              <button 
                onClick={() => setShowCreator(false)}
                className="p-1 hover:bg-graphite-800 rounded-lg text-graphite-400 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Creator Fields */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold font-mono text-graphite-400 uppercase">Bottle/Prefix Title</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Steam Gaming, Legacy Suite"
                  className="glass-input font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold font-mono text-graphite-400 uppercase">Preset Profile Type</label>
                <select 
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="glass-input bg-graphite-800 cursor-pointer font-bold text-xs"
                >
                  <option value="gaming">🎮 Gaming Optimized (DXVK/E-Sync)</option>
                  <option value="productivity">💼 Productivity (Minimal, fonts pre-loaded)</option>
                  <option value="dxvk-optimized">⚡ DirectX optimized (Direct translation)</option>
                  <option value="legacy">💾 Legacy Apps (Windows XP configuration)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold font-mono text-graphite-400 uppercase">Wine Runtime engine</label>
                <select 
                  value={newWineVersion}
                  onChange={(e) => setNewWineVersion(e.target.value)}
                  className="glass-input bg-graphite-800 cursor-pointer text-xs"
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
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-graphite-800/40 bg-graphite-950/40 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreator(false)}
                className="btn-secondary py-1.5 text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                className="btn-primary py-1.5 text-xs"
              >
                Create Bottle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RUN CUSTOM COMMAND MODAL */}
      {showRunCommand && selectedBottle && (
        <div className="fixed inset-0 z-40 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="glass-panel-glow w-full max-w-lg rounded-2xl overflow-hidden border-neon-purple/20 flex flex-col h-[520px] relative bg-graphite-950/90 shadow-[0_0_50px_rgba(157,78,221,0.15)]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-graphite-800/40 bg-graphite-950/40">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-neon-purple" />
                <span className="font-bold text-white font-mono text-sm uppercase">Run Command inside {selectedBottle.name}</span>
              </div>
              {!isRunningCommand && (
                <button 
                  onClick={() => { setShowRunCommand(false); setRunExePath(''); setRunArgs(''); setRunComplete(false); }}
                  className="p-1 hover:bg-graphite-800 rounded-lg text-graphite-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {!isRunningCommand && !runComplete ? (
                <div className="space-y-4 font-mono text-xs">
                  <div className="space-y-1 font-sans">
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Execute Custom Executable</h2>
                    <p className="text-[11px] text-graphite-400">
                      Specify an executable file path and command-line arguments to run inside the active prefix context.
                    </p>
                  </div>

                  <div className="bg-neon-purple/5 border border-neon-purple/20 p-3 rounded-xl space-y-1 flex items-start gap-3">
                    <div className="p-1.5 bg-neon-purple/10 border border-neon-purple/25 rounded text-neon-purple shrink-0 mt-0.5">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-graphite-400">Target Prefix / Environment</span>
                      <p className="font-bold text-white text-sm">{selectedBottle.name}</p>
                      <p className="text-[10px] text-graphite-400 mt-0.5 truncate max-w-xs">{selectedBottle.path}</p>
                    </div>
                  </div>

                  <div className="space-y-3.5 pt-2">
                    {/* Exe Path */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Executable Path (.exe)</label>
                      <input 
                        type="text" 
                        value={runExePath}
                        onChange={(e) => setRunExePath(e.target.value)}
                        className="glass-input font-mono"
                        placeholder="e.g. C:\Program Files\App\app.exe or /path/to/local.exe"
                      />
                    </div>

                    {/* Arguments */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Arguments (Optional)</label>
                      <input 
                        type="text" 
                        value={runArgs}
                        onChange={(e) => setRunArgs(e.target.value)}
                        className="glass-input font-mono"
                        placeholder="e.g. -windowed -nofriendsui"
                      />
                    </div>
                  </div>

                  {/* Preset Examples */}
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] text-graphite-400 uppercase tracking-wider font-mono font-bold">Quick Diagnostics Presets</span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <button 
                        onClick={() => { setRunExePath("C:\\windows\\system32\\winecfg.exe"); setRunArgs(""); }}
                        className="p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-neon-purple/50 text-left text-graphite-200 hover:text-white"
                      >
                        🛠️ Run winecfg (Wine Config)
                      </button>
                      <button 
                        onClick={() => { setRunExePath("C:\\windows\\system32\\regedit.exe"); setRunArgs(""); }}
                        className="p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-neon-purple/50 text-left text-graphite-200 hover:text-white"
                      >
                        🗂️ Run regedit (Registry Editor)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 h-full flex flex-col justify-between">
                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
                      {isRunningCommand ? 'Running Executable...' : 'Execution Completed'}
                    </h2>
                    <p className="text-[11px] text-graphite-400">
                      {isRunningCommand ? 'Wine debugger hook is active. Streaming output streams from prefix.' : 'Process terminated successfully.'}
                    </p>
                  </div>

                  {/* Terminal console */}
                  <div className="flex-1 flex flex-col min-h-[220px]">
                    <span className="text-[9px] font-bold font-mono text-graphite-400 uppercase mb-1">Standard Console Output (stdout/stderr)</span>
                    <div className="bg-black/80 rounded-xl p-4 border border-graphite-850 flex-1 overflow-y-auto font-mono text-[10px] text-neon-purple space-y-1 scrollbar-thin">
                      {logs.map((log, idx) => (
                        <div key={idx} className="leading-relaxed border-l-2 border-neon-purple/35 pl-2 py-0.2 select-text">{log}</div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-graphite-500 italic animate-pulse">Initializing Wine virtual machine...</div>
                      )}
                    </div>
                  </div>

                  {runComplete && (
                    <div className="flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 p-3 rounded-xl">
                      <CheckCircle2 className="w-5 h-5 text-neon-green" />
                      <div className="text-xs font-mono">
                        <span className="font-bold text-white uppercase">Exit Code 0</span>
                        <p className="text-graphite-400 text-[10px]">Virtual wrapper exited successfully and flushed resources.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-graphite-800/40 bg-graphite-950/40 flex items-center justify-between">
              <div className="ml-auto flex gap-3">
                {!isRunningCommand && !runComplete ? (
                  <>
                    <button 
                      onClick={() => { setShowRunCommand(false); setRunExePath(''); setRunArgs(''); }}
                      className="btn-secondary py-2"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleRunCommand}
                      disabled={!runExePath.trim()}
                      className={`btn-primary py-2 px-4 flex items-center gap-1.5 ${
                        !runExePath.trim() ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <Terminal className="w-4.5 h-4.5" /> Run Command
                    </button>
                  </>
                ) : runComplete ? (
                  <button 
                    onClick={() => { setShowRunCommand(false); setRunExePath(''); setRunArgs(''); setRunComplete(false); }}
                    className="btn-primary py-2 px-6"
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

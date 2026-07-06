import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store';
import { AppSettings } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Settings as SettingsIcon,
  CheckCircle2,
  Monitor,
  Cpu,
  HardDrive,
  Info,
  ShieldCheck,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { rosettaDiagnostics, fetchRosettaStatus, notify } = useApp();
  const [verboseLogs, setVerboseLogs] = useState<boolean>(true);
  const [sandboxFiles, setSandboxFiles] = useState<boolean>(true);
  const [wineBinaryPath, setWineBinaryPath] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);

  const persistSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) return;
    const { invoke } = await import('@tauri-apps/api/core');
    const updated = await invoke<AppSettings>('update_settings', {
      wineBinaryPath: patch.wine_binary_path ?? null,
      runtimeStoragePath: patch.runtime_storage_path ?? null,
      sandboxEnabled: patch.sandbox_enabled ?? null,
      verboseLogs: patch.verbose_logs ?? null,
    });
    setVerboseLogs(updated.verbose_logs);
    setSandboxFiles(updated.sandbox_enabled);
    setWineBinaryPath(updated.wine_binary_path);
  }, []);

  useEffect(() => {
    fetchRosettaStatus();

    const loadSettings = async () => {
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (!isTauri) {
        setSettingsLoaded(true);
        return;
      }
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const settings = await invoke<AppSettings>('get_settings');
        setVerboseLogs(settings.verbose_logs);
        setSandboxFiles(settings.sandbox_enabled);
        setWineBinaryPath(settings.wine_binary_path);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, [fetchRosettaStatus]);

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
          <SettingsIcon className="w-5 h-5 text-neon-indigo" /> Settings
        </h1>
        <p className="text-xs text-graphite-400 font-mono">
          Global preferences, diagnostics, and data management.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1 & 2: Main settings */}
        <div className="md:col-span-2 space-y-6">

          {/* General toggles */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-4 h-4 text-neon-indigo" /> General
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3.5 cursor-pointer text-graphite-300">
                <input
                  type="checkbox"
                  checked={verboseLogs}
                  disabled={!settingsLoaded}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setVerboseLogs(next);
                    await persistSettings({ verbose_logs: next });
                  }}
                  className="rounded bg-graphite-900 border-graphite-750 text-neon-indigo cursor-pointer focus:ring-0"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-white">Verbose Logs</span>
                  <span className="text-[10px] text-graphite-500 font-normal">Emit detailed log output during Wine launches.</span>
                </div>
              </label>

              <label className="flex items-center gap-3.5 cursor-pointer text-graphite-300">
                <input
                  type="checkbox"
                  checked={sandboxFiles}
                  disabled={!settingsLoaded}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setSandboxFiles(next);
                    await persistSettings({ sandbox_enabled: next });
                  }}
                  className="rounded bg-graphite-900 border-graphite-750 text-neon-indigo cursor-pointer focus:ring-0"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-white">Prefix Sandbox</span>
                  <span className="text-[10px] text-graphite-500 font-normal">Isolate Wine prefixes from macOS home directories.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Backup & Import/Export */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4">
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-neon-blue" /> Data
            </h2>
            <p className="text-[10px] text-graphite-500 font-mono leading-relaxed">
              Export or import your full FusionCross configuration — bottles, apps, and preferences.
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
                      notify(res, 'success');
                    }
                  } catch (e: any) {
                    notify(`Export failed: ${e.message || e}`, 'error');
                  }
                }}
                className="flex-1 btn-secondary py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-neon-blue" />
                <span>Export Config</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const { invoke } = await import('@tauri-apps/api/core');
                    const path = await invoke<string>('open_file_picker', {
                      title: 'Import FusionCross Config (.json)',
                      fileTypes: ['json']
                    });
                    if (path) {
                      setPendingImportPath(path);
                    }
                  } catch (e: any) {
                    notify(`Import failed: ${e.message || e}`, 'error');
                  }
                }}
                className="flex-1 btn-secondary py-2.5 px-4 text-xs font-mono font-bold flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-neon-green" />
                <span>Import Config</span>
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: System info cards */}
        <div className="space-y-6">
          {/* Silicon Diagnostics */}
          <div className="glass-panel p-6 rounded-2xl border-neon-indigo/30 bg-gradient-to-tr from-neon-indigo/10 to-transparent space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <Cpu className="w-4 h-4 text-neon-indigo" /> Silicon
            </h3>
            <div className="space-y-3.5 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-graphite-450 uppercase">CPU</span>
                <span className="font-bold text-white text-xs truncate" title={rosettaDiagnostics.cpu_brand}>
                  {rosettaDiagnostics.cpu_brand}
                </span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Architecture:</span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
                  rosettaDiagnostics.is_apple_silicon
                    ? 'border-neon-indigo/35 text-neon-indigo bg-neon-indigo/5'
                    : 'border-graphite-700 text-graphite-400 bg-graphite-800'
                }`}>
                  {rosettaDiagnostics.is_apple_silicon ? 'ARM64' : 'x86_64'}
                </span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Rosetta 2:</span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded border ${
                  rosettaDiagnostics.rosetta_installed
                    ? 'border-neon-green/35 text-neon-green bg-neon-green/5'
                    : 'border-red-900/35 text-red-400 bg-red-950/5'
                }`}>
                  {rosettaDiagnostics.rosetta_installed ? 'Installed' : 'Missing'}
                </span>
              </div>
              <button
                onClick={handleManualScan}
                disabled={isScanning}
                className="w-full btn-secondary py-1.5 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 mt-1"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Checking...' : 'Re-check'}</span>
              </button>
            </div>
          </div>

          {/* Environment */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/15">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <Info className="w-4 h-4 text-neon-blue" /> Environment
            </h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center text-graphite-400">
                <span>Wine binary:</span>
                <span className="text-white text-right break-all truncate max-w-[160px]" title={wineBinaryPath || 'Auto-detect'}>
                  {settingsLoaded
                    ? (wineBinaryPath ? wineBinaryPath.split('/').slice(-2).join('/') : 'Auto')
                    : '...'}
                </span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Prefix path:</span>
                <span className="text-white text-right truncate max-w-[160px]">~/.../FusionCross</span>
              </div>
              <div className="flex justify-between items-center text-graphite-400">
                <span>Graphics:</span>
                <span className="text-neon-green font-bold">MoltenVK</span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="glass-panel p-6 rounded-2xl border-graphite-800 space-y-4 bg-graphite-950/15">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2 border-b border-graphite-850 pb-2">
              <ShieldCheck className="w-4 h-4 text-neon-green" /> Security
            </h3>
            <div className="flex items-center gap-2 text-neon-green font-bold text-xs font-mono">
              <CheckCircle2 className="w-4 h-4" /> Sandbox Active
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingImportPath !== null}
        onConfirm={async () => {
          const path = pendingImportPath;
          setPendingImportPath(null);
          if (!path) return;
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const res = await invoke<string>('import_app_data', { importPath: path });
            notify(res, 'success');
            window.location.reload();
          } catch (e: any) {
            notify(`Import failed: ${e.message || e}`, 'error');
          }
        }}
        onCancel={() => setPendingImportPath(null)}
        title="Import Configuration"
        message="This will overwrite all active bottles, apps, and preferences. Continue?"
        confirmLabel="Import"
        variant="warning"
      />
    </div>
  );
};

import React, { useState } from 'react';
import { Bottle } from '../types';
import { Terminal, Database, X, CheckCircle2 } from 'lucide-react';

interface RunCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  bottles: Bottle[];
  selectedBottleId?: string;
  onRun: (bottleId: string, exePath: string, args: string) => Promise<void>;
  accentColor?: 'purple' | 'indigo';
  logs: string[];
  isRunning: boolean;
  isComplete: boolean;
}

export const RunCommandModal: React.FC<RunCommandModalProps> = ({
  isOpen, onClose, bottles, selectedBottleId: initialBottleId, onRun,
  accentColor = 'purple', logs, isRunning, isComplete,
}) => {
  const [runBottleId, setRunBottleId] = useState(initialBottleId || bottles[0]?.id || '');
  const [runExePath, setRunExePath] = useState('');
  const [runArgs, setRunArgs] = useState('');

  const accent = accentColor === 'indigo' ? 'neon-indigo' : 'neon-purple';
  const selectedBottle = bottles.find((b) => b.id === runBottleId);

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!runExePath.trim() || !runBottleId) return;
    await onRun(runBottleId, runExePath, runArgs);
  };

  const handleClose = () => {
    setRunExePath('');
    setRunArgs('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className={`glass-panel-glow w-full max-w-lg rounded-2xl overflow-hidden border-${accent}/20 flex flex-col h-[520px] relative bg-graphite-950/90 shadow-[0_0_50px_rgba(157,78,221,0.15)]`}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-graphite-800/40 bg-graphite-950/40">
          <div className="flex items-center gap-2">
            <Terminal className={`w-5 h-5 text-${accent}`} />
            <span className="font-bold text-white font-mono text-sm uppercase">
              {selectedBottle ? `Run Command inside ${selectedBottle.name}` : 'Run Windows Command'}
            </span>
          </div>
          {!isRunning && (
            <button onClick={handleClose} className="p-1 hover:bg-graphite-800 rounded-lg text-graphite-400 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {!isRunning && !isComplete ? (
            <div className="space-y-4 font-mono text-xs">
              <div className="space-y-1 font-sans">
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wide">Execute Custom Executable</h2>
                <p className="text-[11px] text-graphite-400">
                  Specify an executable file path and command-line arguments to run inside the active prefix context.
                </p>
              </div>

              {bottles.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold font-mono text-graphite-400 uppercase tracking-wider">Wine Prefix/Bottle</label>
                  <select
                    value={runBottleId}
                    onChange={(e) => setRunBottleId(e.target.value)}
                    className="glass-input bg-graphite-850 cursor-pointer font-mono font-bold text-white"
                  >
                    {bottles.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.wine_version})</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBottle && !bottles.length && (
                <div className={`bg-${accent}/5 border border-${accent}/20 p-3 rounded-xl space-y-1 flex items-start gap-3`}>
                  <div className={`p-1.5 bg-${accent}/10 border border-${accent}/25 rounded text-${accent} shrink-0 mt-0.5`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-graphite-400">Target Prefix / Environment</span>
                    <p className="font-bold text-white text-sm">{selectedBottle.name}</p>
                    <p className="text-[10px] text-graphite-400 mt-0.5 truncate max-w-xs">{selectedBottle.path}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3.5 pt-2">
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

              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-graphite-400 uppercase tracking-wider font-mono font-bold">Quick Diagnostics Presets</span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <button
                    onClick={() => { setRunExePath("C:\\windows\\system32\\winecfg.exe"); setRunArgs(""); }}
                    className={`p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-${accent}/50 text-left text-graphite-200 hover:text-white`}
                  >
                    🛠️ Run winecfg (Wine Config)
                  </button>
                  <button
                    onClick={() => { setRunExePath("C:\\windows\\system32\\regedit.exe"); setRunArgs(""); }}
                    className={`p-2.5 bg-graphite-800/80 border border-graphite-700 rounded-xl hover:border-${accent}/50 text-left text-graphite-200 hover:text-white`}
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
                  {isRunning ? 'Running Executable...' : 'Execution Completed'}
                </h2>
                <p className="text-[11px] text-graphite-400">
                  {isRunning ? 'Wine debugger hook is active. Streaming output streams from prefix.' : 'Process terminated successfully.'}
                </p>
              </div>

              <div className="flex-1 flex flex-col min-h-[220px]">
                <span className="text-[9px] font-bold font-mono text-graphite-400 uppercase mb-1">Standard Console Output (stdout/stderr)</span>
                <div className={`bg-black/80 rounded-xl p-4 border border-graphite-850 flex-1 overflow-y-auto font-mono text-[10px] text-${accent} space-y-1 scrollbar-thin`}>
                  {logs.map((log, idx) => (
                    <div key={idx} className={`leading-relaxed border-l-2 border-${accent}/35 pl-2 py-0.2 select-text`}>{log}</div>
                  ))}
                  {logs.length === 0 && (
                    <div className="text-graphite-500 italic animate-pulse">Initializing Wine virtual machine...</div>
                  )}
                </div>
              </div>

              {isComplete && (
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
            {!isRunning && !isComplete ? (
              <>
                <button onClick={handleClose} className="btn-secondary py-2">Cancel</button>
                <button
                  onClick={handleRun}
                  disabled={!runExePath.trim()}
                  className={`btn-primary py-2 px-4 flex items-center gap-1.5 ${!runExePath.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <Terminal className="w-4.5 h-4.5" /> Run Command
                </button>
              </>
            ) : isComplete ? (
              <button onClick={handleClose} className="btn-primary py-2 px-6">Done</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

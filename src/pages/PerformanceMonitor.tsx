import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { 
  Activity, 
  Terminal, 
  Cpu, 
  ShieldAlert, 
  Trash2, 
  Pause, 
  Play, 
  Copy,
  TrendingUp,
  Flame,
  AppWindow
} from 'lucide-react';

export const PerformanceMonitor: React.FC = () => {
  const { metrics, logs, clearLogs, apps, activeAppId, stopApp } = useApp();
  const [autoscroll, setAutoscroll] = useState<boolean>(true);
  const [paused, setPaused] = useState<boolean>(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  
  const [frozenLogs, setFrozenLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!paused) {
      setFrozenLogs(logs);
    }
  }, [logs, paused]);

  useEffect(() => {
    if (autoscroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [frozenLogs, autoscroll]);

  const handleCopyLogs = () => {
    const text = frozenLogs.join('\n');
    navigator.clipboard.writeText(text);
  };

  const runningApp = apps.find(a => a.id === activeAppId);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 h-full bg-graphite-900/40">
      <div className="h-4 select-none pointer-events-none" />

      {/* Header */}
      <div className="space-y-1 border-b border-graphite-800/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-neon-pink" /> Performance & Diagnostics
        </h1>
        <p className="text-xs text-graphite-400 font-mono">
          Real-time container execution statistics, translation caching, and active process log telemetry.
        </p>
      </div>

      {/* Resource Gauge Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* FPS Indicator (Only when app runs) */}
        <div className="glass-panel p-5 rounded-2xl border-graphite-800 flex flex-col justify-between h-36 bg-graphite-950/15 relative overflow-hidden">
          {runningApp && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-purple/5 rounded-full blur-2xl pointer-events-none" />
          )}
          <div className="flex justify-between items-center text-xs font-mono font-bold text-graphite-400">
            <span>FRAMES PER SECOND</span>
            <Flame className="w-4.5 h-4.5 text-neon-purple animate-pulse" />
          </div>
          <div className="flex items-baseline gap-1 mt-4">
            <span className="text-4xl font-extrabold font-mono tracking-tight text-white">
              {runningApp ? metrics.fps : "00"}
            </span>
            <span className="text-xs text-graphite-400 font-mono">FPS</span>
          </div>
          <span className="text-[10px] text-graphite-500 font-mono">
            {runningApp ? "Rendering overlay active" : "No active translation layer"}
          </span>
        </div>

        {/* CPU footprint */}
        <div className="glass-panel p-5 rounded-2xl border-graphite-800 flex flex-col justify-between h-36 bg-graphite-950/15">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-graphite-400">
            <span>CPU FOOTPRINT</span>
            <Cpu className="w-4.5 h-4.5 text-neon-indigo" />
          </div>
          <div className="flex items-baseline gap-1 mt-4">
            <span className="text-4xl font-extrabold font-mono tracking-tight text-white">
              {metrics.cpu_usage.toFixed(1)}
            </span>
            <span className="text-xs text-graphite-400 font-mono">% LOAD</span>
          </div>
          <div className="w-full bg-graphite-800 h-1 rounded-full overflow-hidden">
            <div className="bg-neon-indigo h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(100, metrics.cpu_usage * 2)}%` }} />
          </div>
        </div>

        {/* GPU usage */}
        <div className="glass-panel p-5 rounded-2xl border-graphite-800 flex flex-col justify-between h-36 bg-graphite-950/15">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-graphite-400">
            <span>GPU WORKLOAD</span>
            <Activity className="w-4.5 h-4.5 text-neon-pink" />
          </div>
          <div className="flex items-baseline gap-1 mt-4">
            <span className="text-4xl font-extrabold font-mono tracking-tight text-white">
              {metrics.gpu_usage.toFixed(1)}
            </span>
            <span className="text-xs text-graphite-400 font-mono">% LOAD</span>
          </div>
          <div className="w-full bg-graphite-800 h-1 rounded-full overflow-hidden">
            <div className="bg-neon-pink h-full rounded-full transition-all duration-300" style={{ width: `${metrics.gpu_usage}%` }} />
          </div>
        </div>

        {/* Shader caching */}
        <div className="glass-panel p-5 rounded-2xl border-graphite-800 flex flex-col justify-between h-36 bg-graphite-950/15">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-graphite-400">
            <span>VULKAN SHADER CACHE</span>
            <TrendingUp className="w-4.5 h-4.5 text-neon-green" />
          </div>
          <div className="flex items-baseline gap-1 mt-4">
            <span className="text-4xl font-extrabold font-mono tracking-tight text-white">
              {runningApp ? metrics.shader_compilation_percent : "00"}
            </span>
            <span className="text-xs text-graphite-400 font-mono">% CACHED</span>
          </div>
          <div className="w-full bg-graphite-800 h-1 rounded-full overflow-hidden">
            <div className="bg-neon-green h-full rounded-full transition-all duration-300" style={{ width: `${runningApp ? metrics.shader_compilation_percent : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Main Process Info banner */}
      <div className="glass-panel p-5 rounded-2xl border-graphite-800 bg-graphite-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center text-neon-pink">
            <AppWindow className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Active Executable Sandbox</h3>
            <p className="text-xs text-graphite-400 font-mono mt-0.5">
              {runningApp ? (
                <>Process active: <strong className="text-neon-pink">{runningApp.name}</strong> (PID: {metrics.active_pid || 'N/A'})</>
              ) : (
                "No process active. Launch a Windows EXE to stream debugger diagnostic telemetry."
              )}
            </p>
          </div>
        </div>

        {runningApp && (
          <button 
            onClick={stopApp}
            className="btn-danger text-xs font-mono py-2"
          >
            TERMINATE RUNTIME
          </button>
        )}
      </div>

      {/* Log Console Output terminal */}
      <div className="glass-panel rounded-2xl border-graphite-800 overflow-hidden flex flex-col h-96 shadow-lg bg-graphite-950">
        
        {/* Console Header */}
        <div className="p-3.5 bg-graphite-950 border-b border-graphite-850 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="w-4.5 h-4.5 text-neon-pink" />
            <span className="font-bold text-white uppercase tracking-wider">Debugger Trace Terminal</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Play/Pause streaming */}
            <button 
              onClick={() => setPaused(!paused)}
              className="p-1.5 hover:bg-graphite-800/80 rounded text-graphite-400 hover:text-white transition-all flex items-center gap-1 hover:scale-105"
            >
              {paused ? <Play className="w-3.5 h-3.5 text-neon-green" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{paused ? "Resume" : "Pause"}</span>
            </button>

            {/* Clear Console */}
            <button 
              onClick={clearLogs}
              className="p-1.5 hover:bg-graphite-800/80 rounded text-graphite-400 hover:text-white transition-all flex items-center gap-1 hover:scale-105"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            {/* Copy Logs */}
            <button 
              onClick={handleCopyLogs}
              className="p-1.5 hover:bg-graphite-800/80 rounded text-graphite-400 hover:text-white transition-all flex items-center gap-1 hover:scale-105"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* Terminal Screen lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs text-graphite-300 bg-graphite-950 select-text">
          {frozenLogs.map((log, idx) => (
            <div key={idx} className="flex gap-4 hover:bg-graphite-900/40 py-0.5 px-1 rounded transition-colors duration-150">
              <span className="text-graphite-600 select-none w-8 text-right font-light">{(idx + 1).toString().padStart(3, '0')}</span>
              <span className={`flex-1 break-all ${
                log.includes("error") || log.includes("fail") 
                  ? 'text-red-400 font-semibold' 
                  : log.includes("dxvk") || log.includes("MoltenVK")
                  ? 'text-neon-indigo'
                  : 'text-graphite-350'
              }`}>{log}</span>
            </div>
          ))}

          {frozenLogs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-graphite-500 space-y-2">
              <ShieldAlert className="w-8 h-8 text-graphite-700 animate-pulse" />
              <span>Terminal log stream ready. No signals preloaded.</span>
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Autoscroll control */}
        <div className="p-2 bg-graphite-950 border-t border-graphite-850 flex items-center justify-end text-[10px] font-mono text-graphite-500">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-graphite-300 transition-colors select-none">
            <input 
              type="checkbox" 
              checked={autoscroll}
              onChange={(e) => setAutoscroll(e.target.checked)}
              className="rounded bg-graphite-900 border-graphite-750 text-neon-pink focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span>Autoscroll Stream</span>
          </label>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useApp } from '../store';
import { Play, Activity, Download, PlusCircle, CheckCircle2, Clock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { apps, bottles, runtimes, launchApp, activeAppId, metrics, setActiveTab, setShowWizard } = useApp();

  const favoriteApps = apps.filter(a => a.favorite);
  const recentlyPlayed = apps
    .filter(a => a.last_played)
    .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())
    .slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 h-full bg-graphite-900/40">
      {/* Draggable spacer padding */}
      <div className="h-4 select-none pointer-events-none" />

      {/* Hero Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-neon-indigo/25 via-neon-purple/20 to-graphite-800/10 border border-neon-indigo/20 p-8 shadow-neon-indigo/5">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-neon-indigo/15 to-transparent blur-3xl pointer-events-none" />
        <div className="space-y-4 max-w-xl relative">
          <span className="text-xs uppercase font-mono tracking-widest text-neon-indigo font-bold bg-neon-indigo/10 px-3 py-1 rounded-full border border-neon-indigo/20">
            System Workspace
          </span>
          <h1 className="text-3xl font-extrabold text-white tracking-tight font-mono">
            Welcome to FusionWine
          </h1>
          <p className="text-sm text-graphite-300 leading-relaxed">
            Unleash Windows application power natively on macOS. Manage isolated bottles, configure Vulkan/DXVK backends, and run your library with Apple Silicon optimization.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button 
              onClick={() => setShowWizard(true)}
              className="btn-primary flex items-center gap-1.5 shadow-[0_0_15px_rgba(157,78,221,0.3)] border border-neon-purple/35 bg-neon-purple hover:bg-neon-purple/80"
            >
              <Download className="w-4 h-4 animate-bounce" /> Install a Windows Application...
            </button>
            <button 
              onClick={() => setActiveTab('library')}
              className="btn-secondary"
            >
              <Play className="w-4 h-4" /> Open App Library
            </button>
            <button 
              onClick={() => setActiveTab('bottles')}
              className="btn-secondary"
            >
              <PlusCircle className="w-4 h-4" /> Create Prefix
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Dashboard Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800 hover:border-graphite-700 transition-all duration-300 relative group">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">CPU Usage</span>
            <Activity className="w-4 h-4 text-neon-indigo" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {metrics.cpu_usage.toFixed(1)}
            </span>
            <span className="text-xs text-graphite-400 font-mono">%</span>
          </div>
          <div className="w-full bg-graphite-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-neon-indigo to-neon-purple h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, metrics.cpu_usage * 2)}%` }} 
            />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800 hover:border-graphite-700 transition-all duration-300">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Active Memory</span>
            <Activity className="w-4 h-4 text-neon-purple" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {metrics.ram_used_gb.toFixed(2)}
            </span>
            <span className="text-xs text-graphite-400 font-mono">/ {metrics.ram_total_gb} GB</span>
          </div>
          <div className="w-full bg-graphite-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-neon-purple to-neon-pink h-full rounded-full transition-all duration-500" 
              style={{ width: `${metrics.ram_usage_percent}%` }} 
            />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800 hover:border-graphite-700 transition-all duration-300">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Active Prefix Size</span>
            <Activity className="w-4 h-4 text-neon-pink" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {(bottles.reduce((acc, b) => acc + b.size_bytes, 0) / 1_000_000_000).toFixed(2)}
            </span>
            <span className="text-xs text-graphite-400 font-mono">GB</span>
          </div>
          <div className="text-[10px] text-graphite-400 font-mono mt-3">
            Across {bottles.length} isolated prefixes
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800 hover:border-graphite-700 transition-all duration-300">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold">Wine Runtimes</span>
            <CheckCircle2 className="w-4 h-4 text-neon-green" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">
              {runtimes.filter(r => r.downloaded).length}
            </span>
            <span className="text-xs text-graphite-400 font-mono">Installed</span>
          </div>
          <div className="text-[10px] text-graphite-400 font-mono mt-3">
            {runtimes.filter(r => !r.downloaded).length} runtimes available to download
          </div>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Recently Played Apps */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-neon-indigo" /> Recently Played
            </h2>
            <button 
              onClick={() => setActiveTab('library')}
              className="text-xs text-neon-indigo hover:text-white transition-colors"
            >
              View Catalog
            </button>
          </div>

          <div className="space-y-3">
            {recentlyPlayed.length > 0 ? (
              recentlyPlayed.map((app) => (
                <div 
                  key={app.id} 
                  className="glass-panel p-4 rounded-xl flex items-center justify-between border-graphite-800 hover:border-graphite-700/60 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {/* Mock Cover Art Avatar */}
                    <div className="w-12 h-16 rounded bg-gradient-to-b from-graphite-800 to-graphite-950 border border-graphite-800 flex items-center justify-center font-mono font-bold text-lg text-neon-indigo relative overflow-hidden group-hover:scale-105 transition-all">
                      {app.icon === 'steam' && <span className="text-neon-indigo">S</span>}
                      {app.icon === 'cyberpunk' && <span className="text-neon-pink">C</span>}
                      {app.icon === 'office' && <span className="text-neon-blue">O</span>}
                      {app.icon === 'generic' && <span className="text-graphite-500">W</span>}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-white leading-tight">
                        {app.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-graphite-400 font-mono">
                        <span className="flex items-center gap-1">
                          Playtime: <strong className="text-graphite-200">{(app.play_time_mins / 60).toFixed(1)}h</strong>
                        </span>
                        <span>•</span>
                        <span>Bottle: <strong className="text-graphite-200">{bottles.find(b => b.id === app.bottle_id)?.name || 'Default'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => launchApp(app.id)}
                    disabled={activeAppId !== null}
                    className="p-2.5 rounded-xl bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/25 hover:bg-neon-indigo hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group-hover:scale-105"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                </div>
              ))
            ) : (
              <div className="glass-panel p-8 text-center text-graphite-400 text-sm rounded-xl">
                No application history. Install your first app from the library!
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Bottle Quick Statuses */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-neon-purple" /> Active Bottles
            </h2>
            <button 
              onClick={() => setActiveTab('bottles')}
              className="text-xs text-neon-purple hover:text-white transition-colors"
            >
              Configure
            </button>
          </div>

          <div className="space-y-3">
            {bottles.map((bottle) => (
              <div 
                key={bottle.id} 
                className="glass-panel p-4 rounded-xl space-y-3 border-graphite-800 hover:border-graphite-700/60 transition-all cursor-pointer"
                onClick={() => setActiveTab('bottles')}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-white">{bottle.name}</h3>
                    <span className="text-[10px] text-graphite-400 font-mono uppercase bg-graphite-800/80 px-2 py-0.5 rounded border border-graphite-700/40">
                      {bottle.prefix_type}
                    </span>
                  </div>
                  <span className="text-xs text-graphite-400 font-mono">
                    {(bottle.size_bytes / 1_000_000).toFixed(0)} MB
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-mono text-graphite-300">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${bottle.dxvk_enabled ? 'bg-neon-indigo shadow-[0_0_6px_rgba(99,102,241,0.8)]' : 'bg-graphite-600'}`} />
                    DXVK
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${bottle.moltenvk_enabled ? 'bg-neon-purple shadow-[0_0_6px_rgba(157,78,221,0.8)]' : 'bg-graphite-600'}`} />
                    MoltenVK
                  </span>
                  <span className="text-graphite-400 ml-auto">
                    {bottle.wine_version}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

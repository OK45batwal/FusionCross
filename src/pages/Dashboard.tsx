import React from 'react';
import { useApp } from '../store';
import { Play, Activity, ChevronRight, HardDrive } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { apps, bottles, metrics, activeAppId, launchApp, setActiveTab, setShowWizard } = useApp();

  const favoriteApps = apps.filter(a => a.favorite);
  const recentlyPlayed = apps
    .filter(a => a.last_played)
    .sort((a, b) => new Date(b.last_played!).getTime() - new Date(a.last_played!).getTime())
    .slice(0, 3);

  const totalSizeGb = bottles.reduce((acc, b) => acc + b.size_bytes, 0) / 1_000_000_000;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 h-full bg-graphite-900/40">
      <div className="h-4 select-none pointer-events-none" />

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-neon-indigo/25 via-neon-purple/20 to-graphite-800/10 border border-neon-indigo/20 p-8">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-neon-indigo/15 to-transparent blur-3xl pointer-events-none" />
        <div className="space-y-4 max-w-xl relative">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.svg" alt="" width="28" height="28" className="shrink-0" />
            <span className="text-[10px] uppercase font-mono tracking-widest text-neon-indigo font-bold bg-neon-indigo/10 px-3 py-1 rounded-full border border-neon-indigo/20">
              System Overview
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome to FusionCross
          </h1>
          <p className="text-sm text-graphite-300 leading-relaxed max-w-lg">
            Run Windows applications on macOS with Wine bottles.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setShowWizard(true)}
              className="btn-primary"
            >
              Install Application
            </button>
            <button
              onClick={() => setActiveTab('bottles')}
              className="btn-secondary"
            >
              Bottles <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">CPU</span>
            <Activity className="w-4 h-4 text-neon-indigo" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">{metrics.cpu_usage.toFixed(0)}</span>
            <span className="text-xs text-graphite-400 font-mono">%</span>
          </div>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Memory</span>
            <Activity className="w-4 h-4 text-neon-purple" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">{metrics.ram_usage_percent.toFixed(0)}</span>
            <span className="text-xs text-graphite-400 font-mono">%</span>
          </div>
        </div>
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-graphite-800">
          <div className="flex items-center justify-between text-graphite-400">
            <span className="text-[10px] uppercase font-mono tracking-wider font-semibold">Storage</span>
            <HardDrive className="w-4 h-4 text-neon-pink" />
          </div>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono tracking-tight text-white">{totalSizeGb.toFixed(1)}</span>
            <span className="text-xs text-graphite-400 font-mono">GB</span>
          </div>
          <div className="text-[10px] text-graphite-400 font-mono mt-3">{bottles.length} bottle{bottles.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Quick Launch */}
      {favoriteApps.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
            <Play className="w-4 h-4 text-neon-indigo" /> Quick Launch
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {favoriteApps.map((app) => (
              <button
                key={app.id}
                onClick={() => launchApp(app.id)}
                disabled={activeAppId !== null}
                className="glass-panel p-4 rounded-xl flex flex-col items-center gap-2 border-graphite-800 hover:border-neon-indigo/40 hover:bg-neon-indigo/5 transition-all disabled:opacity-50 group"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-graphite-800 to-graphite-950 border border-graphite-700 flex items-center justify-center font-mono text-lg font-bold text-neon-indigo group-hover:scale-110 transition-transform">
                  {app.name.charAt(0)}
                </div>
                <span className="text-xs text-graphite-300 font-mono truncate w-full text-center">{app.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
            Recently Played
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentlyPlayed.map((app) => (
              <div
                key={app.id}
                className="glass-panel p-4 rounded-xl flex items-center justify-between border-graphite-800 hover:border-graphite-700/60 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-14 rounded-lg bg-gradient-to-b from-graphite-800 to-graphite-950 border border-graphite-800 flex items-center justify-center font-mono font-bold text-lg text-neon-indigo shrink-0">
                    {app.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{app.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-graphite-400 font-mono mt-0.5">
                      <span>{(app.play_time_mins / 60).toFixed(1)}h</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => launchApp(app.id)}
                  disabled={activeAppId !== null}
                  className="p-2.5 rounded-xl bg-neon-indigo/15 text-neon-indigo border border-neon-indigo/25 hover:bg-neon-indigo hover:text-white transition-all disabled:opacity-50 shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

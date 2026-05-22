import React from 'react';
import { useApp } from '../store';
import { 
  LayoutDashboard, 
  Gamepad2, 
  Compass,
  Layers, 
  Activity, 
  DownloadCloud, 
  Settings,
  Circle,
  Cpu,
  Power
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, activeAppId, apps, stopApp, metrics } = useApp();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'library', name: 'Library', icon: Gamepad2 },
    { id: 'catalog', name: 'Software Store', icon: Compass },
    { id: 'bottles', name: 'Bottle Manager', icon: Layers },
    { id: 'performance', name: 'Telemetry', icon: Activity },
    { id: 'downloads', name: 'Runtime Store', icon: DownloadCloud },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const runningApp = apps.find(a => a.id === activeAppId);

  return (
    <div className="w-64 h-full border-r border-graphite-800/80 bg-graphite-900/65 flex flex-col backdrop-blur-2xl">
      {/* Title bar draggable area spacing for macOS titlebar buttons */}
      <div className="h-12 border-b border-graphite-800/40 flex items-center px-6 select-none cursor-default">
        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-indigo via-neon-purple to-neon-pink tracking-wide text-lg mt-1 font-mono">
          FUSIONWINE
        </span>
        <span className="text-[10px] bg-neon-indigo/20 text-neon-indigo border border-neon-indigo/30 font-semibold px-1.5 py-0.5 rounded ml-2.5 mt-1 font-mono tracking-wider">
          V1.0
        </span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <div className="text-[10px] text-graphite-400 font-bold px-3 mb-2 tracking-wider uppercase">
          Application
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                isActive 
                  ? 'bg-gradient-to-r from-neon-indigo/15 to-neon-purple/10 text-white border-l-2 border-neon-indigo shadow-neon-indigo/5' 
                  : 'text-graphite-400 hover:text-graphite-100 hover:bg-graphite-800/40 border-l-2 border-transparent'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-105 ${
                isActive ? 'text-neon-indigo' : 'text-graphite-400 group-hover:text-graphite-200'
              }`} />
              <span>{item.name}</span>

              {/* Glowing decorative state dots */}
              {isActive && (
                <div className="absolute right-3 w-1 h-1 bg-neon-indigo rounded-full shadow-[0_0_8px_rgba(99,102,241,1)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Running Telemetry Footer */}
      <div className="p-4 border-t border-graphite-800/80 bg-graphite-950/45 space-y-3">
        {runningApp ? (
          <div className="glass-panel-glow p-3.5 rounded-xl space-y-2 border-neon-purple/30 bg-graphite-900/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <Circle className="w-2.5 h-2.5 text-neon-purple fill-neon-purple animate-pulse" />
                <span className="text-xs font-semibold text-graphite-200 truncate pr-1">
                  {runningApp.name}
                </span>
              </div>
              <button 
                onClick={stopApp}
                className="p-1.5 bg-red-950/30 border border-red-900/60 rounded-lg text-red-400 hover:text-white hover:bg-red-900/50 hover:scale-105 active:scale-95 transition-all duration-150"
                title="Force Terminate"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1 text-[10px] font-mono text-graphite-400">
              <div className="flex flex-col">
                <span>FPS</span>
                <span className="text-xs font-bold text-neon-purple mt-0.5">{metrics.fps} FPS</span>
              </div>
              <div className="flex flex-col">
                <span>GPU UT</span>
                <span className="text-xs font-bold text-graphite-200 mt-0.5">{metrics.gpu_usage}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel p-3.5 rounded-xl bg-graphite-900/40">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-neon-indigo" />
              <div className="flex flex-col">
                <span className="text-[10px] text-graphite-400 uppercase tracking-wider font-mono">Telemetry Status</span>
                <span className="text-xs font-semibold text-graphite-300">System Standby</span>
              </div>
            </div>
          </div>
        )}

        {/* Minimal metrics row */}
        <div className="flex items-center justify-between text-[10px] font-mono text-graphite-400 px-1">
          <span className="flex items-center gap-1">
            CPU: <strong className="text-graphite-200">{metrics.cpu_usage.toFixed(0)}%</strong>
          </span>
          <span className="flex items-center gap-1">
            RAM: <strong className="text-graphite-200">{metrics.ram_usage_percent.toFixed(0)}%</strong>
          </span>
        </div>
      </div>
    </div>
  );
};

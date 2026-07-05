import React, { useState } from 'react';
import { useApp } from '../store';
import {
  Gamepad2,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Circle
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, activeAppId, apps, stopApp } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'bottles', name: 'Bottles', icon: Layers },
    { id: 'library', name: 'Library', icon: Gamepad2 },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  const runningApp = apps.find(a => a.id === activeAppId);

  return (
    <div
      className={`h-full border-r border-graphite-800/80 bg-graphite-900/65 flex flex-col backdrop-blur-2xl transition-all duration-300 relative ${
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-14 z-10 w-6 h-6 rounded-full bg-graphite-800 border border-graphite-700 flex items-center justify-center text-graphite-400 hover:text-white hover:border-graphite-500 transition-all"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* macOS traffic light spacing + branding */}
      <div className="h-12 border-b border-graphite-800/40 flex items-center px-4 select-none cursor-default shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <img src="/images/logo-icon.svg" alt="FusionCross" width="24" height="24" className="shrink-0" />
          {!collapsed && (
            <>
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-indigo via-neon-purple to-neon-pink tracking-wide text-lg font-mono truncate">
                FUSIONCROSS
              </span>
              <span className="text-[9px] bg-neon-indigo/20 text-neon-indigo border border-neon-indigo/30 font-semibold px-1.5 py-0.5 rounded font-mono tracking-wider shrink-0">
                V1.0
              </span>
            </>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {!collapsed && (
          <div className="text-[9px] text-graphite-400 font-bold px-3 mb-2 tracking-wider uppercase">
            Navigation
          </div>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.name : undefined}
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-neon-indigo/15 to-neon-purple/10 text-white shadow-[inset_0_0_0_1px_rgba(99,102,241,0.15)]'
                  : 'text-graphite-400 hover:text-graphite-100 hover:bg-graphite-800/40'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 transition-all duration-200 ${
                isActive
                  ? 'text-neon-indigo'
                  : 'text-graphite-400 group-hover:text-graphite-200 group-hover:scale-105'
              }`} aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.name}</span>}

              {/* Active indicator dot */}
              {isActive && (
                <div className={`absolute right-2 w-1.5 h-1.5 bg-neon-indigo rounded-full shadow-[0_0_6px_rgba(99,102,241,0.8)] ${
                  collapsed ? 'static ml-auto' : ''
                }`} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Running App Status Footer */}
      <div className="p-3 border-t border-graphite-800/80 bg-graphite-950/45 shrink-0">
        {runningApp ? (
          <div className="glass-panel-glow p-3 rounded-xl flex items-center justify-between border-neon-purple/30 bg-graphite-900/60">
            <div className="flex items-center gap-2 overflow-hidden min-w-0">
              <Circle className="w-2 h-2 text-neon-purple fill-neon-purple animate-pulse shrink-0" />
              {!collapsed && (
                <span className="text-xs font-semibold text-graphite-200 truncate">
                  {runningApp.name}
                </span>
              )}
            </div>
          </div>
        ) : (
          !collapsed && (
            <div className="text-[10px] text-graphite-400 font-mono text-center">
              No active bottles
            </div>
          )
        )}
      </div>
    </div>
  );
};

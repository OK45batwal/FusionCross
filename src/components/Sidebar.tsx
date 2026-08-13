import React from "react";
import {
  LayoutGrid,
  AppWindow,
  Heart,
  Clock,
  FlaskConical,
  Boxes,
  Cpu,
  Activity,
  Settings,
  Download,
  Terminal,
  Globe,
} from "lucide-react";

export type ViewId =
  | "home"
  | "applications"
  | "favorites"
  | "recent"
  | "bottles"
  | "runtimes"
  | "installer"
  | "compatibility"
  | "diagnostics"
  | "website"
  | "settings";

interface SidebarProps {
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  onOpenCommandPalette: () => void;
  runningCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenCommandPalette,
  runningCount,
}) => {
  const navGroups = [
    {
      label: "LIBRARY",
      items: [
        { id: "home" as ViewId, label: "Home", icon: LayoutGrid },
        { id: "applications" as ViewId, label: "Applications", icon: AppWindow },
        { id: "favorites" as ViewId, label: "Favorites", icon: Heart },
        { id: "recent" as ViewId, label: "Recent", icon: Clock },
      ],
    },
    {
      label: "ENVIRONMENTS",
      items: [
        { id: "bottles" as ViewId, label: "Bottles", icon: FlaskConical },
        { id: "runtimes" as ViewId, label: "Runtimes", icon: Boxes },
      ],
    },
    {
      label: "TOOLS",
      items: [
        { id: "installer" as ViewId, label: "Install App", icon: Download },
        { id: "compatibility" as ViewId, label: "Compatibility", icon: Cpu },
        { id: "diagnostics" as ViewId, label: "Diagnostics", icon: Activity },
        { id: "website" as ViewId, label: "Website & DB", icon: Globe },
      ],
    },
  ];

  return (
    <nav className="w-[230px] shrink-0 border-r border-graphite-600/60 flex flex-col bg-graphite-900 select-none">
      {/* App Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-graphite-600/60">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate("home")}>
          <span className="w-7 h-7 rounded-lg bg-accent-500 flex items-center justify-center text-[13px] font-bold font-mono text-white shadow-sm shadow-accent-500/30">
            F
          </span>
          <div>
            <h1 className="font-mono text-[13px] font-bold tracking-[1.5px] text-graphite-100">FUSIONCROSS</h1>
            <p className="text-[9px] font-mono text-graphite-300">v2.0 MVP · Mac Way</p>
          </div>
        </div>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-ok/10 text-ok border border-ok/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" />
            {runningCount}
          </span>
        )}
      </div>

      {/* Main Install Call to Action */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => onNavigate("installer")}
          className="w-full py-2.5 px-3 rounded-md bg-accent-500 hover:bg-accent-400 active:scale-[0.98] text-white text-[11px] font-mono font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-accent-500/20"
        >
          <Download className="w-4 h-4" /> INSTALL APP
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] font-mono tracking-[1.5px] text-graphite-400 font-semibold">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentView === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-medium transition-all ${
                      isActive
                        ? "text-graphite-100 bg-graphite-800 border border-graphite-600/70 shadow-sm"
                        : "text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/40"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-accent-400" : "text-graphite-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Rail Controls */}
      <div className="px-3 py-3 border-t border-graphite-600/60 space-y-1">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-graphite-400" />
            <span>Command Palette</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-graphite-800 border border-graphite-600 text-graphite-300 rounded">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => onNavigate("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
            currentView === "settings"
              ? "text-graphite-100 bg-graphite-800 border border-graphite-600/70"
              : "text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/50"
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-graphite-400" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};

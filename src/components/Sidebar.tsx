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
    <nav className="w-[230px] shrink-0 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] select-none transition-colors duration-300">
      {/* App Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate("home")}>
          <img src="/logo.png" alt="FusionCross Logo" className="w-7 h-7 rounded-lg shadow-sm object-cover" />
          <div>
            <h1 className="font-mono text-[13px] font-bold tracking-[1.5px] text-[var(--text-main)]">FUSIONCROSS</h1>
            <p className="text-[9px] font-mono text-[var(--text-muted)]">v2.0 MVP · Mac Way</p>
          </div>
        </div>
        {runningCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-ok-glow)] text-[var(--color-ok)] border border-[var(--color-ok)]/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />
            {runningCount}
          </span>
        )}
      </div>

      {/* Main Install Call to Action */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => onNavigate("installer")}
          className="w-full py-2.5 px-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:scale-[0.98] text-white text-[11px] font-mono font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-[var(--accent-glow)] cursor-pointer"
        >
          <Download className="w-4 h-4" /> INSTALL APP
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] font-mono tracking-[1.5px] text-[var(--text-muted)] font-bold">
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
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "text-[var(--text-main)] bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Rail Controls */}
      <div className="px-3 py-3 border-t border-[var(--border-color)] space-y-1">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>Command Palette</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={() => onNavigate("settings")}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-colors cursor-pointer ${
            currentView === "settings"
              ? "text-[var(--text-main)] bg-[var(--bg-elevated)] border border-[var(--border-color)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/50"
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};

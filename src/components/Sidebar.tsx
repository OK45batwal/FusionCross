import React from "react";
import {
  LayoutGrid,
  Heart,
  FlaskConical,
  Boxes,
  Cpu,
  Activity,
  Settings,
  Plus,
  Terminal,
  Moon,
  Sun,
  Download,
  Gamepad2,
} from "lucide-react";
import { Bottle, RunningInfo } from "../services/tauri";

export type ViewId =
  | "all_apps"
  | "favorites"
  | "catalog"
  | "bottle"
  | "installer"
  | "compatibility"
  | "diagnostics"
  | "runtimes"
  | "settings";

interface SidebarProps {
  currentView: ViewId;
  onNavigate: (view: ViewId) => void;
  bottles: Bottle[];
  selectedBottleId: string | null;
  onSelectBottle: (bottleId: string) => void;
  onCreateBottle: () => void;
  onOpenCommandPalette: () => void;
  runningInfo: RunningInfo[];
  totalAppsCount: number;
  favoritesCount: number;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  bottles,
  selectedBottleId,
  onSelectBottle,
  onCreateBottle,
  onOpenCommandPalette,
  runningInfo,
  totalAppsCount,
  favoritesCount,
  theme,
  onToggleTheme,
}) => {
  return (
    <aside className="w-[240px] shrink-0 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-surface)] select-none text-[13px] font-sans transition-colors duration-200">
      {/* App Titlebar Drag & Brand Header */}
      <div className="px-4 py-3.5 border-b border-[var(--border-color)] flex items-center justify-between">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onNavigate("all_apps")}
        >
          <img
            src="/logo.png"
            alt="FusionCross Logo"
            className="w-6 h-6 rounded-md shadow-xs object-cover"
          />
          <div>
            <h1 className="font-semibold text-[13px] tracking-tight text-[var(--text-main)] leading-none">
              FusionCross
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
              Windows on Mac
            </p>
          </div>
        </div>

        {runningInfo.length > 0 && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[var(--color-ok-glow)] text-[var(--color-ok)] border border-[var(--color-ok)]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] animate-pulse" />
            {runningInfo.length} active
          </span>
        )}
      </div>

      {/* Primary Action Button (CrossOver-style "+ Install Windows App") */}
      <div className="p-3">
        <button
          onClick={() => onNavigate("installer")}
          className="w-full py-2 px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] active:scale-[0.98] text-white text-[12px] font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install a Windows App</span>
        </button>
      </div>

      {/* Scrollable Navigation Area */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {/* Library Section */}
        <div>
          <div className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-[var(--text-muted)] uppercase font-semibold">
            Library
          </div>
          <div className="space-y-0.5 mt-0.5">
            <button
              onClick={() => onNavigate("all_apps")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "all_apps"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[var(--text-muted)]" />
                <span>All Applications</span>
              </div>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                {totalAppsCount}
              </span>
            </button>

            <button
              onClick={() => onNavigate("favorites")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "favorites"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Favorites</span>
              </div>
              {favoritesCount > 0 && (
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onNavigate("catalog")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "catalog"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Game Catalog</span>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                50+
              </span>
            </button>
          </div>
        </div>

        {/* Bottles Section (Master-Detail List) */}
        <div>
          <div className="px-2.5 py-1 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-wider text-[var(--text-muted)] uppercase font-semibold">
              Bottles
            </span>
            <button
              onClick={onCreateBottle}
              title="Create new bottle"
              className="p-1 rounded hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5 mt-0.5">
            {bottles.length === 0 ? (
              <p className="px-2.5 py-2 text-[11px] text-[var(--text-muted)] italic">
                No bottles created yet.
              </p>
            ) : (
              bottles.map((b) => {
                const isSelected = currentView === "bottle" && selectedBottleId === b.id;
                const isRunning = runningInfo.some((r) => r.bottle_id === b.id);
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSelectBottle(b.id);
                      onNavigate("bottle");
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FlaskConical
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
                        }`}
                      />
                      <div className="truncate">
                        <p className="truncate text-[12px] font-medium leading-snug">
                          {b.name}
                        </p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)] leading-tight truncate">
                          {b.windows_version} · {b.graphics.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    {isRunning && (
                      <span
                        title="Process running in this bottle"
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)] shrink-0 animate-pulse ml-1"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* System & Tools Section */}
        <div>
          <div className="px-2.5 py-1 text-[10px] font-mono tracking-wider text-[var(--text-muted)] uppercase font-semibold">
            System
          </div>
          <div className="space-y-0.5 mt-0.5">
            <button
              onClick={() => onNavigate("compatibility")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "compatibility"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <Cpu className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Compatibility</span>
            </button>

            <button
              onClick={() => onNavigate("diagnostics")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "diagnostics"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <Activity className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Diagnostics</span>
            </button>

            <button
              onClick={() => onNavigate("runtimes")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "runtimes"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <Boxes className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Wine Runtimes</span>
            </button>

            <button
              onClick={() => onNavigate("settings")}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                currentView === "settings"
                  ? "bg-[var(--bg-elevated)] text-[var(--text-main)] shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              <Settings className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Quick Controls Bar */}
      <div className="p-2.5 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Quick Actions</span>
          <kbd className="px-1 text-[9px] font-mono bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onToggleTheme}
          title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-blue-500" />
          )}
        </button>
      </div>
    </aside>
  );
};

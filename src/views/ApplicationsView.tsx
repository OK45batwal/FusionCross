import React, { useState } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Play,
  Square,
  Heart,
  Activity,
  AlertTriangle,
  AppWindow,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import { Application, Bottle, RunningInfo } from "../services/tauri";
import { ViewId } from "../components/Sidebar";

interface ApplicationsViewProps {
  applications: Application[];
  bottles: Bottle[];
  runningInfo: RunningInfo[];
  onLaunchApp: (appId: string) => void;
  onStopApp: (appId: string) => void;
  onToggleFavorite: (appId: string) => void;
  onNavigate: (view: ViewId) => void;
  filterMode?: "all" | "favorites" | "recent";
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  bottles,
  runningInfo,
  onLaunchApp,
  onStopApp,
  onToggleFavorite,
  onNavigate,
  filterMode = "all",
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const categories = ["all", "games", "productivity", "utilities", "applications"];

  const filtered = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || app.category.toLowerCase() === selectedCategory;
    const matchesFilterMode =
      filterMode === "all" ||
      (filterMode === "favorites" && app.favorite) ||
      (filterMode === "recent" && app.last_played !== null);
    return matchesSearch && matchesCategory && matchesFilterMode;
  });

  const getBottleName = (bottleId: string) => {
    const b = bottles.find((b) => b.id === bottleId);
    return b ? b.name : "Default Bottle";
  };

  const isRunning = (appId: string) => runningInfo.some((r) => r.app_id === appId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
      {/* Header controls */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Categories */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[var(--accent-primary)] text-white font-semibold shadow-sm"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[var(--border-hover)] border border-[var(--border-color)]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle & Install CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-[var(--bg-elevated)] p-1 border border-[var(--border-color)]">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "list" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)]"
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onNavigate("installer")}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            + Add Application
          </button>
        </div>
      </div>

      {/* Main Grid/List Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
              <AppWindow className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[var(--text-main)]">No applications found</h3>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1 max-w-sm">
                Install a Windows application using the smart installer wizard or adjust your search filter.
              </p>
            </div>
            <button
              onClick={() => onNavigate("installer")}
              className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-mono font-bold shadow-md cursor-pointer transition-all"
            >
              Launch Smart Installer
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const score = app.compatibility ?? 88;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`group rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between relative ${
                    active
                      ? "bg-[var(--color-ok-glow)] border-[var(--color-ok)]/50 shadow-md"
                      : "bg-[var(--bg-surface)] border-[var(--border-color)] hover:border-[var(--border-hover)] hover:-translate-y-0.5"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center font-mono font-bold text-[var(--accent-primary)] text-[14px]">
                          {app.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <h3 className="text-[14px] font-bold text-[var(--text-main)] truncate max-w-[140px]">
                            {app.name}
                          </h3>
                          <p className="text-[10px] font-mono text-[var(--text-muted)]">
                            {getBottleName(app.bottle_id)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(app.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          app.favorite ? "text-red-500" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${app.favorite ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2 mt-3">
                      {active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-ok-glow)] text-[var(--color-ok)] border border-[var(--color-ok)]/30 flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" /> RUNNING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)]">
                          {app.category}
                        </span>
                      )}

                      {score < 75 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {score}% Compat
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--color-ok-glow)] text-[var(--color-ok)] border border-[var(--color-ok)]/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {score}% Compat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {app.launch_count} launches
                    </span>

                    {active ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-500 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Square className="w-3 h-3 fill-current" /> STOP
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" /> LAUNCH
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-color)]">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const score = app.compatibility ?? 88;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="p-3 hover:bg-[var(--bg-elevated)] transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center font-mono font-bold text-[var(--accent-primary)] text-[13px]">
                      {app.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h4 className="text-[13px] font-bold text-[var(--text-main)]">{app.name}</h4>
                      <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                        {app.category} · Bottle: {getBottleName(app.bottle_id)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                      Score: <span className="text-[var(--color-ok)] font-semibold">{score}%</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(app.id);
                      }}
                      className={`p-1 rounded ${
                        app.favorite ? "text-red-500" : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${app.favorite ? "fill-current" : ""}`} />
                    </button>

                    {active ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-mono font-bold flex items-center gap-1"
                      >
                        <Square className="w-3 h-3 fill-current" /> STOP
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" /> LAUNCH
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 flex items-center justify-center font-mono font-bold text-[var(--accent-primary)] text-[18px]">
                  {selectedApp.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-[var(--text-main)]">{selectedApp.name}</h3>
                  <p className="text-[12px] font-mono text-[var(--text-secondary)]">
                    Category: {selectedApp.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] font-mono text-[12px]">
              <div>
                <span className="text-[var(--text-muted)]">Bottle: </span>
                <span className="text-[var(--text-main)] font-semibold">{getBottleName(selectedApp.bottle_id)}</span>
              </div>
              <div className="truncate">
                <span className="text-[var(--text-muted)]">Executable Path: </span>
                <span className="text-[var(--accent-primary)] font-semibold">{selectedApp.executable_path}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Launch Count: </span>
                <span className="text-[var(--text-main)] font-semibold">{selectedApp.launch_count}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Compatibility Score: </span>
                <span className="text-[var(--color-ok)] font-bold">{selectedApp.compatibility ?? 88}%</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setSelectedApp(null);
                  onNavigate("diagnostics");
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] text-[var(--text-main)] text-[11px] font-mono flex items-center gap-1.5 border border-[var(--border-color)] cursor-pointer transition-colors"
              >
                <Activity className="w-3.5 h-3.5 text-amber-500" /> Diagnostics
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onToggleFavorite(selectedApp.id);
                    setSelectedApp({ ...selectedApp, favorite: !selectedApp.favorite });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1 border cursor-pointer ${
                    selectedApp.favorite
                      ? "bg-red-500/10 border-red-500/30 text-red-500"
                      : "bg-[var(--bg-elevated)] border-[var(--border-color)] text-[var(--text-secondary)]"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${selectedApp.favorite ? "fill-current" : ""}`} />
                  {selectedApp.favorite ? "Favorited" : "Favorite"}
                </button>

                {isRunning(selectedApp.id) ? (
                  <button
                    onClick={() => {
                      onStopApp(selectedApp.id);
                      setSelectedApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> STOP
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLaunchApp(selectedApp.id);
                      setSelectedApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> LAUNCH
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

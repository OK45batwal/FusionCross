import React, { useState, useEffect } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Play,
  Square,
  Heart,
  Activity,
  AppWindow,
  X,
  Share,
  RefreshCw,
  MoreVertical,
  Trash2,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import {
  Application,
  Bottle,
  RunningInfo,
  exportAppBundle,
  scanAllBottles,
  revealInFinder,
  unregisterApplication,
  updateApplication,
} from "../services/tauri";
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
  onRefreshState?: () => Promise<void> | void;
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
  onRefreshState,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [menuAppId, setMenuAppId] = useState<string | null>(null);
  const [appLaunchArgs, setAppLaunchArgs] = useState("");
  const [saveArgsSuccess, setSaveArgsSuccess] = useState(false);

  const handleSelectApp = (app: Application | null) => {
    setSelectedApp(app);
    setAppLaunchArgs(app?.launch_arguments || "");
    setSaveArgsSuccess(false);
  };

  const handleSaveLaunchArgs = async () => {
    if (!selectedApp) return;
    try {
      const updated = await updateApplication(selectedApp.id, {
        launchArguments: appLaunchArgs,
      });
      setSelectedApp(updated);
      setSaveArgsSuccess(true);
      setTimeout(() => setSaveArgsSuccess(false), 2000);
      if (onRefreshState) await onRefreshState();
    } catch {
      // handled
    }
  };

  useEffect(() => {
    const handleCloseMenu = () => setMenuAppId(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  const handleScanAll = async () => {
    setScanning(true);
    try {
      await scanAllBottles();
      if (onRefreshState) await onRefreshState();
    } catch {
      // scan error handled gracefully
    } finally {
      setScanning(false);
    }
  };

  const hasAutoScannedRef = React.useRef(false);

  useEffect(() => {
    let active = true;
    if (!hasAutoScannedRef.current && applications.length === 0 && bottles.length > 0) {
      hasAutoScannedRef.current = true;
      scanAllBottles()
        .then(() => {
          if (active && onRefreshState) {
            onRefreshState();
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [bottles.length, applications.length, onRefreshState]);

  const [confirmDeleteApp, setConfirmDeleteApp] = useState<Application | null>(null);

  const handleUnregisterApp = async (appId: string) => {
    try {
      await unregisterApplication(appId);
      if (onRefreshState) await onRefreshState();
      if (selectedApp?.id === appId) handleSelectApp(null);
      setConfirmDeleteApp(null);
    } catch {
      // handled
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await revealInFinder(path);
    } catch {
      // handled
    }
  };

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
    <div className="flex-1 flex flex-col overflow-hidden bg-(--bg-main) text-(--text-main) transition-colors duration-300">
      {/* Header controls */}
      <div className="p-4 border-b border-(--border-color) bg-(--bg-surface) flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Categories */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
            <input
              type="text"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] font-mono text-(--text-main) placeholder-(--text-muted) focus:outline-none focus:border-(--accent-primary) transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-(--accent-primary) text-white font-semibold shadow-sm"
                    : "bg-(--bg-elevated) text-(--text-secondary) hover:text-(--text-main) hover:border-(--border-hover) border border-(--border-color)"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle & Install CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-(--bg-elevated) p-1 border border-(--border-color)">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-(--accent-primary) text-white" : "text-(--text-muted)"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                viewMode === "list" ? "bg-(--accent-primary) text-white" : "text-(--text-muted)"
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleScanAll}
            disabled={scanning}
            className="px-2.5 py-1.5 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Scan all bottle C: drives for installed Windows applications"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-(--accent-primary) ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Scanning..." : "Scan Bottles"}</span>
          </button>

          <button
            onClick={() => onNavigate("installer")}
            className="px-3 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            + Add Application
          </button>
        </div>
      </div>

      {/* Main Grid/List Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-(--bg-elevated) border border-(--border-color) flex items-center justify-center text-(--text-muted)">
              <AppWindow className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-(--text-main)">No applications found</h3>
              <p className="text-[12px] text-(--text-secondary) mt-1 max-w-sm">
                Install a Windows application using the smart installer wizard or scan your bottles.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate("installer")}
                className="px-4 py-2 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[12px] font-mono font-bold shadow-md cursor-pointer transition-all"
              >
                Launch Smart Installer
              </button>
              <button
                onClick={handleScanAll}
                disabled={scanning}
                className="px-4 py-2 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[12px] font-mono font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                <span>{scanning ? "Scanning..." : "Scan Bottles"}</span>
              </button>
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-2">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const isMenuOpen = menuAppId === app.id;
              return (
                <div
                  key={app.id}
                  onClick={() => handleSelectApp(app)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (active) onStopApp(app.id);
                    else onLaunchApp(app.id);
                  }}
                  className="group relative flex flex-col items-center p-3.5 rounded-2xl border border-transparent hover:border-(--border-color) hover:bg-(--bg-surface) hover:shadow-sm transition-all duration-150 cursor-pointer select-none text-center"
                >
                  {/* App Icon (macOS Launchpad / CrossOver style 64x64) */}
                  <div className="relative w-16 h-16 rounded-2xl bg-(--bg-elevated) border border-(--border-color) shadow-xs flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105">
                    {app.icon_data ? (
                      <img
                        src={app.icon_data}
                        alt={app.name}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-[22px] text-(--accent-primary) bg-linear-to-br from-(--bg-elevated) to-(--bg-surface)">
                        {app.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Running Indicator (Green status dot) */}
                    {active && (
                      <span
                        title="Application is running"
                        className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-(--bg-surface) shadow-xs animate-pulse"
                      />
                    )}

                    {/* Hover Quick Launch Scrim */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (active) {
                          onStopApp(app.id);
                        } else {
                          onLaunchApp(app.id);
                        }
                      }}
                      className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      title={active ? "Stop Application" : "Launch Application"}
                    >
                      {active ? (
                        <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md">
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-(--accent-primary) text-white flex items-center justify-center shadow-md">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* App Title */}
                  <div className="mt-2.5 max-w-30 w-full">
                    <p
                      className="text-[12.5px] font-medium text-(--text-main) truncate leading-tight group-hover:text-(--accent-primary) transition-colors"
                      title={app.name}
                    >
                      {app.name}
                    </p>
                    <p className="text-[10px] font-mono text-(--text-muted) truncate mt-0.5">
                      {getBottleName(app.bottle_id)}
                    </p>
                  </div>

                  {/* Context Menu Button */}
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAppId(isMenuOpen ? null : app.id);
                      }}
                      className={`p-1 rounded-md text-(--text-muted) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer ${
                        isMenuOpen ? "opacity-100 bg-(--bg-elevated) text-(--text-main)" : "opacity-0 group-hover:opacity-100"
                      }`}
                      title="Options"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-7 w-48 rounded-xl bg-(--bg-elevated) border border-(--border-color) shadow-xl py-1 z-30 text-left text-[12px] font-mono animate-in fade-in zoom-in-95 duration-100"
                      >
                        {active ? (
                          <button
                            onClick={() => {
                              onStopApp(app.id);
                              setMenuAppId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop Application</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              onLaunchApp(app.id);
                              setMenuAppId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-(--bg-surface) text-(--text-main) flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-current text-(--accent-primary)" />
                            <span>Launch Application</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onToggleFavorite(app.id);
                            setMenuAppId(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-(--bg-surface) text-(--text-main) flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Heart className={`w-3.5 h-3.5 ${app.favorite ? "fill-red-500 text-red-500" : "text-(--text-muted)"}`} />
                          <span>{app.favorite ? "Favorited" : "Favorite"}</span>
                        </button>

                        <button
                          onClick={async () => {
                            setMenuAppId(null);
                            try {
                              await exportAppBundle(app.id);
                            } catch {
                              // ignore
                            }
                          }}
                          className="w-full px-3 py-1.5 hover:bg-(--bg-surface) text-(--text-main) flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-(--text-muted)" />
                          <span>Export as Mac App</span>
                        </button>

                        <button
                          onClick={() => {
                            handleReveal(app.executable_path);
                            setMenuAppId(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-(--bg-surface) text-(--text-main) flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5 text-(--text-muted)" />
                          <span>Reveal in Finder</span>
                        </button>

                        <div className="my-1 border-t border-(--border-color)" />

                        <button
                          onClick={() => {
                            setConfirmDeleteApp(app);
                            setMenuAppId(null);
                          }}
                          className="w-full px-3 py-1.5 hover:bg-red-500/10 text-red-500 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove from Shelf</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="rounded-xl border border-(--border-color) bg-(--bg-surface) overflow-hidden divide-y divide-(--border-color)">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const score = app.compatibility ?? 88;
              return (
                <div
                  key={app.id}
                  onClick={() => handleSelectApp(app)}
                  className="p-3 hover:bg-(--bg-elevated) transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {app.icon_data ? (
                      <img
                        src={app.icon_data}
                        alt={app.name}
                        className="w-8 h-8 rounded-lg object-contain bg-(--bg-elevated) p-1 border border-(--border-color) shrink-0 shadow-xs"
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-lg bg-(--bg-elevated) border border-(--border-color) flex items-center justify-center font-mono font-bold text-(--accent-primary) text-[13px] shrink-0">
                        {app.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div>
                      <h4 className="text-[13px] font-bold text-(--text-main)">{app.name}</h4>
                      <p className="text-[11px] font-mono text-(--text-secondary)">
                        {app.category} · Bottle: {getBottleName(app.bottle_id)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-(--text-secondary)">
                      Score: <span className="text-ok font-semibold">{score}%</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(app.id);
                      }}
                      className={`p-1 rounded ${
                        app.favorite ? "text-red-500" : "text-(--text-muted) hover:text-(--text-main)"
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
                        className="px-3 py-1 rounded bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-mono font-bold flex items-center gap-1"
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
          <div className="w-full max-w-lg rounded-2xl border border-(--border-color) bg-(--bg-surface) p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {selectedApp.icon_data ? (
                  <img
                    src={selectedApp.icon_data}
                    alt={selectedApp.name}
                    className="w-12 h-12 rounded-xl object-contain bg-(--bg-elevated) p-1.5 border border-(--border-color) shadow-sm shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-xl bg-(--accent-primary)/10 border border-(--accent-primary)/30 flex items-center justify-center font-mono font-bold text-(--accent-primary) text-[18px] shrink-0">
                    {selectedApp.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h3 className="text-[18px] font-bold text-(--text-main)">{selectedApp.name}</h3>
                  <p className="text-[12px] font-mono text-(--text-secondary)">
                    Category: {selectedApp.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSelectApp(null)}
                className="p-1 rounded text-(--text-muted) hover:text-(--text-main) cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-xl bg-(--bg-elevated) p-4 border border-(--border-color) font-mono text-[12px]">
              <div>
                <span className="text-(--text-muted)">Bottle: </span>
                <span className="text-(--text-main) font-semibold">{getBottleName(selectedApp.bottle_id)}</span>
              </div>
              <div className="truncate">
                <span className="text-(--text-muted)">Executable Path: </span>
                <span className="text-(--accent-primary) font-semibold">{selectedApp.executable_path}</span>
              </div>
              <div>
                <span className="text-(--text-muted)">Launch Count: </span>
                <span className="text-(--text-main) font-semibold">{selectedApp.launch_count}</span>
              </div>
              <div>
                <span className="text-(--text-muted)">Play Time: </span>
                <span className="text-(--text-main) font-semibold">
                  {selectedApp.play_time_mins > 0
                    ? selectedApp.play_time_mins < 60
                      ? `${selectedApp.play_time_mins} minutes`
                      : `${(selectedApp.play_time_mins / 60).toFixed(1)} hours`
                    : "0 minutes"}
                </span>
              </div>
              <div>
                <span className="text-(--text-muted)">Compatibility Score: </span>
                <span className="text-ok font-bold">{selectedApp.compatibility ?? 88}%</span>
              </div>
            </div>

            {/* Launch Arguments Editor */}
            <div className="rounded-xl bg-(--bg-elevated) p-4 border border-(--border-color) space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-mono font-bold text-(--text-main)">
                  Launch Arguments
                </span>
                {saveArgsSuccess && (
                  <span className="text-[10px] text-ok font-mono">
                    ✓ Saved
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. -dx11 -novid -fullscreen"
                  value={appLaunchArgs}
                  onChange={(e) => setAppLaunchArgs(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-(--bg-surface) border border-(--border-color) text-(--text-main) font-mono text-[11px]"
                />
                <button
                  onClick={handleSaveLaunchArgs}
                  className="px-3 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  Save
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleSelectApp(null);
                    onNavigate("diagnostics");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) text-(--text-main) text-[11px] font-mono flex items-center gap-1.5 border border-(--border-color) cursor-pointer transition-colors"
                >
                  <Activity className="w-3.5 h-3.5 text-amber-500" /> Diagnostics
                </button>

                <button
                  onClick={async () => {
                    setExportStatus(null);
                    try {
                      const res = await exportAppBundle(selectedApp.id);
                      setExportStatus({ ok: true, text: `Exported to: ${res}` });
                    } catch (e) {
                      setExportStatus({ ok: false, text: `Export failed: ${String(e)}` });
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) text-(--text-main) text-[11px] font-mono flex items-center gap-1.5 border border-(--border-color) cursor-pointer transition-colors"
                >
                  <Share className="w-3.5 h-3.5 text-(--accent-primary)" /> Export .app
                </button>

                <button
                  onClick={() => setConfirmDeleteApp(selectedApp)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[11px] font-mono flex items-center gap-1.5 border border-red-500/30 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove from Shelf
                </button>
              </div>

              {exportStatus && (
                <div
                  className={`px-3 py-2 rounded-lg border font-mono text-[11px] ${
                    exportStatus.ok
                      ? "border-ok/40 bg-(--color-ok-glow) text-ok"
                      : "border-red-500/40 bg-red-500/10 text-red-500"
                  }`}
                >
                  {exportStatus.ok ? "✓ " : "⚠ "}
                  {exportStatus.text}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onToggleFavorite(selectedApp.id);
                    setSelectedApp({ ...selectedApp, favorite: !selectedApp.favorite });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1 border cursor-pointer ${
                    selectedApp.favorite
                      ? "bg-red-500/10 border-red-500/30 text-red-500"
                      : "bg-(--bg-elevated) border-(--border-color) text-(--text-secondary)"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${selectedApp.favorite ? "fill-current" : ""}`} />
                  {selectedApp.favorite ? "Favorited" : "Favorite"}
                </button>

                {isRunning(selectedApp.id) ? (
                  <button
                    onClick={() => {
                      onStopApp(selectedApp.id);
                      handleSelectApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> STOP
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLaunchApp(selectedApp.id);
                      handleSelectApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> LAUNCH
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove from Shelf Confirmation Modal */}
      {confirmDeleteApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-(--bg-surface) border border-(--border-color) p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-(--text-main)">Remove from Shelf?</h3>
              <p className="text-[12px] text-(--text-muted) mt-1.5 leading-relaxed">
                Are you sure you want to remove <span className="font-semibold text-(--text-main)">"{confirmDeleteApp.name}"</span>? The files inside your bottle prefix will not be deleted.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setConfirmDeleteApp(null)}
                className="px-4 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-(--text-main) text-[12px] font-semibold hover:bg-(--bg-surface) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnregisterApp(confirmDeleteApp.id)}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import { useEffect, useState, useCallback } from "react";
import { Sidebar, ViewId } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { BottleWorkspaceView } from "./views/BottleWorkspaceView";
import { ApplicationsView } from "./views/ApplicationsView";
import { InstallerWizardView } from "./views/InstallerWizardView";
import { CatalogView } from "./views/CatalogView";
import { RuntimeManagerView } from "./views/RuntimeManagerView";
import { CompatibilityView } from "./views/CompatibilityView";
import { DiagnosticsView } from "./views/DiagnosticsView";
import { SettingsView } from "./views/SettingsView";
import {
  getSystemInfo,
  getState,
  getTemplates,
  createBottle,
  launchApplication,
  stopApplication,
  listRunning,
  toggleFavorite,
  AppState,
  BottleTemplate,
  RunningInfo,
  SystemInfo,
  FusionErrorPayload,
} from "./services/tauri";
import { RefreshCw, X, FlaskConical } from "lucide-react";
import { GlobalDropZone } from "./components/GlobalDropZone";
import { DroppedFileModal } from "./components/DroppedFileModal";
import { ToastContainer, ToastItem } from "./components/Toast";

export function App() {
  const [currentView, setCurrentView] = useState<ViewId>("all_apps");
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("fusioncross-theme");
    return (saved as "dark" | "light") || "dark";
  });

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [templates, setTemplates] = useState<BottleTemplate[]>([]);
  const [runningInfo, setRunningInfo] = useState<RunningInfo[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Create Bottle Modal state
  const [showCreateBottleModal, setShowCreateBottleModal] = useState(false);
  const [newBottleName, setNewBottleName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("gaming");
  const [creatingBottle, setCreatingBottle] = useState(false);

  // Dropped file inspection state
  const [droppedFilePath, setDroppedFilePath] = useState<string | null>(null);
  const [droppedTargetBottleId, setDroppedTargetBottleId] = useState<string>("");

  const addToast = useCallback(
    (type: ToastItem["type"], message: string, title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev.slice(-4), { id, type, message, title }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fusioncross-theme", theme);
  }, [theme]);

  // Full state refresh (system info, templates, app state, running processes)
  const refreshState = useCallback(async () => {
    try {
      const [sys, st, tmpl, run] = await Promise.all([
        getSystemInfo().catch(() => null),
        getState().catch(() => null),
        getTemplates().catch(() => []),
        listRunning().catch(() => []),
      ]);
      if (sys) setSystemInfo(sys);
      if (st) {
        setState(st);
        setSelectedBottleId((prev) => {
          if (!prev && st.bottles.length > 0) return st.bottles[0].id;
          if (prev && !st.bottles.some((b) => b.id === prev)) {
            return st.bottles.length > 0 ? st.bottles[0].id : null;
          }
          return prev;
        });
      }
      if (tmpl) setTemplates(tmpl);
      if (run) setRunningInfo(run);
    } catch (e) {
      addToast("error", (e as FusionErrorPayload).message || String(e), "Sync Failed");
    }
  }, [addToast]);

  // Lightweight recurring poll (only dynamic app state & running process telemetry)
  const pollDynamicState = useCallback(async () => {
    try {
      const [st, run] = await Promise.all([
        getState().catch(() => null),
        listRunning().catch(() => []),
      ]);
      if (st) {
        setState(st);
        setSelectedBottleId((prev) => {
          if (!prev && st.bottles.length > 0) return st.bottles[0].id;
          if (prev && !st.bottles.some((b) => b.id === prev)) {
            return st.bottles.length > 0 ? st.bottles[0].id : null;
          }
          return prev;
        });
      }
      if (run) setRunningInfo(run);
    } catch {
      // Quiet background polling
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await refreshState();
    };
    init();
    const interval = setInterval(pollDynamicState, 3500);
    return () => clearInterval(interval);
  }, [refreshState, pollDynamicState]);

  // Global Hotkey ⌘ K listener for Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    await refreshState();
    setIsSyncing(false);
    addToast("success", "Application state synchronized successfully.", "Synced");
  };

  const handleLaunchApp = async (appId: string) => {
    try {
      await launchApplication(appId);
      addToast("info", "Starting application process...", "Launching");
      await pollDynamicState();
    } catch (e) {
      const err = e as FusionErrorPayload;
      addToast("error", err.message || "Failed to launch process.", "Launch Failed");
    }
  };

  const handleStopApp = async (appId: string) => {
    try {
      await stopApplication(appId);
      addToast("info", "Stopping application process...", "Stopping");
      await pollDynamicState();
    } catch (e) {
      const err = e as FusionErrorPayload;
      addToast("error", err.message || "Failed to stop process.", "Stop Failed");
    }
  };

  const handleToggleFavorite = async (appId: string) => {
    try {
      await toggleFavorite(appId);
      await pollDynamicState();
    } catch {
      // silent
    }
  };

  const toggleTheme = () => {
    setTheme((prev: "dark" | "light") => (prev === "dark" ? "light" : "dark"));
  };

  const handleSelectBottle = (bottleId: string) => {
    setSelectedBottleId(bottleId);
    setCurrentView("bottle");
  };

  const handleCreateBottle = async () => {
    if (!newBottleName.trim()) return;
    setCreatingBottle(true);
    try {
      const b = await createBottle(newBottleName.trim(), selectedTemplate);
      setShowCreateBottleModal(false);
      setNewBottleName("");
      setSelectedBottleId(b.id);
      setCurrentView("bottle");
      addToast("success", `Bottle "${b.name}" created successfully.`, "Bottle Ready");
      await refreshState();
    } catch (e) {
      addToast("error", (e as FusionErrorPayload).message || "Failed to create bottle.", "Creation Failed");
    } finally {
      setCreatingBottle(false);
    }
  };

  if (!state) {
    return (
      <div className="flex h-screen w-screen bg-(--bg-main) text-(--text-main) font-sans select-none overflow-hidden">
        {/* Skeleton Sidebar */}
        <div className="w-64 border-r border-(--border-color) bg-(--bg-surface) p-4 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-(--bg-elevated) animate-pulse" />
            <div className="h-4 w-28 bg-(--bg-elevated) rounded animate-pulse" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="h-7 bg-(--bg-elevated) rounded-lg animate-pulse" />
            <div className="h-7 bg-(--bg-elevated) rounded-lg animate-pulse" />
            <div className="h-7 bg-(--bg-elevated) rounded-lg animate-pulse" />
          </div>
          <div className="mt-6 space-y-2">
            <div className="h-3 w-16 bg-(--bg-elevated) rounded animate-pulse" />
            <div className="h-7 bg-(--bg-elevated) rounded-lg animate-pulse" />
            <div className="h-7 bg-(--bg-elevated) rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Skeleton Main Content */}
        <div className="flex-1 flex flex-col p-6 space-y-6">
          <div className="h-9 w-48 bg-(--bg-elevated) rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-(--bg-elevated) rounded-xl animate-pulse" />
            <div className="h-32 bg-(--bg-elevated) rounded-xl animate-pulse" />
            <div className="h-32 bg-(--bg-elevated) rounded-xl animate-pulse" />
          </div>
          <div className="h-64 bg-(--bg-elevated) rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const selectedBottle =
    state.bottles.find((b) => b.id === selectedBottleId) ||
    (state.bottles.length ? state.bottles[0] : null);

  const totalAppsCount = state.applications.length;
  const favoritesCount = state.applications.filter((a) => a.favorite).length;

  return (
    <div className="flex h-screen w-screen bg-(--bg-main) text-(--text-main) font-sans select-none overflow-hidden transition-colors duration-200">
      {/* Left Navigation Sidebar (CrossOver-style master layout) */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        bottles={state?.bottles || []}
        selectedBottleId={selectedBottleId}
        onSelectBottle={handleSelectBottle}
        onCreateBottle={() => setShowCreateBottleModal(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        runningInfo={runningInfo}
        totalAppsCount={totalAppsCount}
        favoritesCount={favoritesCount}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-(--bg-main)">
        {/* Top Header Bar */}
        <header className="h-11 shrink-0 px-6 flex items-center justify-between border-b border-(--border-color) bg-(--bg-glass) backdrop-blur-md text-[12px] font-sans">
          <div className="flex items-center gap-2 text-(--text-muted)">
            <span className="font-semibold text-(--text-main)">
              {currentView === "bottle" && selectedBottle
                ? selectedBottle.name
                : currentView === "all_apps"
                ? "All Applications"
                : currentView === "favorites"
                ? "Favorites"
                : currentView === "installer"
                ? "Install Windows Application"
                : currentView === "compatibility"
                ? "Compatibility Center"
                : currentView === "diagnostics"
                ? "Diagnostics & Health"
                : currentView === "runtimes"
                ? "Wine Runtimes"
                : "Settings"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-mono text-(--text-muted)">
            {systemInfo && (
              <span className="hidden sm:inline">
                macOS {systemInfo.os} · {systemInfo.arch}
              </span>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="hover:text-(--text-main) transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh State"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync"}</span>
            </button>
          </div>
        </header>

        {/* Main Content View Switcher */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentView === "bottle" && selectedBottle && (
            <BottleWorkspaceView
              bottle={selectedBottle}
              applications={state?.applications || []}
              runningInfo={runningInfo}
              templates={templates}
              snapshots={state?.snapshots || []}
              onLaunchApp={handleLaunchApp}
              onStopApp={handleStopApp}
              onToggleFavorite={handleToggleFavorite}
              onRefreshState={refreshState}
              onOpenInstaller={() => setCurrentView("installer")}
              onBottleDeleted={() => {
                setSelectedBottleId(null);
                setCurrentView("all_apps");
              }}
              onSelectBottle={handleSelectBottle}
            />
          )}

          {currentView === "all_apps" && (
            <ApplicationsView
              applications={state?.applications || []}
              bottles={state?.bottles || []}
              runningInfo={runningInfo}
              onLaunchApp={handleLaunchApp}
              onStopApp={handleStopApp}
              onToggleFavorite={handleToggleFavorite}
              onNavigate={(v) => setCurrentView(v)}
              filterMode="all"
              onRefreshState={refreshState}
            />
          )}

          {currentView === "favorites" && (
            <ApplicationsView
              applications={state?.applications || []}
              bottles={state?.bottles || []}
              runningInfo={runningInfo}
              onLaunchApp={handleLaunchApp}
              onStopApp={handleStopApp}
              onToggleFavorite={handleToggleFavorite}
              onNavigate={(v) => setCurrentView(v)}
              filterMode="favorites"
              onRefreshState={refreshState}
            />
          )}

          {currentView === "installer" && (
            <InstallerWizardView
              bottles={state?.bottles || []}
              onFinish={() => setCurrentView("all_apps")}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "catalog" && (
            <CatalogView
              bottles={state?.bottles || []}
              onOpenInstaller={(bottleId) => {
                setSelectedBottleId(bottleId);
                setCurrentView("installer");
              }}
              onRefreshState={refreshState}
              onSelectBottle={handleSelectBottle}
            />
          )}

          {currentView === "compatibility" && <CompatibilityView />}

          {currentView === "diagnostics" && (
            <DiagnosticsView
              applications={state?.applications || []}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "runtimes" && (
            <RuntimeManagerView
              runtimes={state?.runtimes || []}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              settings={state?.settings || []}
              onRefreshState={refreshState}
            />
          )}
        </div>
      </main>

      {/* Global Command Palette Overlay (⌘ K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(v) => setCurrentView(v)}
        onSelectBottle={handleSelectBottle}
        applications={state?.applications || []}
        bottles={state?.bottles || []}
        runtimes={state?.runtimes || []}
        onLaunchApp={handleLaunchApp}
      />

      {/* Global Modal: Create New Bottle */}
      {showCreateBottleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-(--bg-surface) border border-(--border-color) p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-(--accent-primary)" />
                <h3 className="text-[14px] font-semibold text-(--text-main)">
                  Create New Bottle Environment
                </h3>
              </div>
              <button
                onClick={() => setShowCreateBottleModal(false)}
                className="text-(--text-muted) hover:text-(--text-main) cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-(--text-muted) block mb-1">
                  Bottle Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Steam, Cyberpunk 2077, Office 365"
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] text-(--text-main) focus:outline-none focus:border-(--accent-primary)"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-(--text-muted) block mb-1">
                  Environment Template
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: "gaming", label: "Gaming (DirectX 12 / D3DMetal + MSync)", desc: "High-performance gaming with Apple GPTK & Mach fast sync" },
                    { id: "office", label: "Office & Productivity", desc: "Windows 10 with CoreFonts and MSXML" },
                    { id: "adobe", label: "Creative & Adobe Suite", desc: "Configured for creative software suites" },
                    { id: "development", label: "Development & Engineering", desc: "Visual C++ runtimes and developer utilities" },
                  ].map((tmpl) => (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        selectedTemplate === tmpl.id
                          ? "bg-(--accent-primary)/10 border-(--accent-primary) text-(--text-main)"
                          : "bg-(--bg-elevated) border-(--border-color) hover:border-(--border-hover) text-(--text-secondary)"
                      }`}
                    >
                      <p className="text-[12px] font-medium">{tmpl.label}</p>
                      <p className="text-[10px] text-(--text-muted) mt-0.5">{tmpl.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateBottleModal(false)}
                className="px-3 py-1.5 rounded-lg border border-(--border-color) text-[12px] font-medium text-(--text-secondary) hover:bg-(--bg-elevated) cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBottle}
                disabled={!newBottleName.trim() || creatingBottle}
                className="px-4 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
              >
                {creatingBottle ? "Creating..." : "Create Bottle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Drag & Drop Window-wide Listener & Overlay */}
      <GlobalDropZone
        bottles={state?.bottles || []}
        selectedBottleId={selectedBottleId}
        onFileDropped={(filePath, targetBottleId) => {
          setDroppedFilePath(filePath);
          setDroppedTargetBottleId(targetBottleId);
        }}
      />

      {/* Dropped File Inspection & One-Click Execution Modal */}
      {droppedFilePath && (
        <DroppedFileModal
          filePath={droppedFilePath}
          initialBottleId={droppedTargetBottleId || selectedBottleId || ""}
          bottles={state?.bottles || []}
          onClose={() => setDroppedFilePath(null)}
          onRefresh={refreshState}
          onSelectBottle={(id) => {
            setSelectedBottleId(id);
            setCurrentView("bottle");
          }}
        />
      )}

      {/* Notifications Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
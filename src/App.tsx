import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { Sidebar, ViewId } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
const BottleWorkspaceView = lazy(() => import("./views/BottleWorkspaceView").then((module) => ({ default: module.BottleWorkspaceView })));
const ApplicationsView = lazy(() => import("./views/ApplicationsView").then((module) => ({ default: module.ApplicationsView })));
const InstallerWizardView = lazy(() => import("./views/InstallerWizardView").then((module) => ({ default: module.InstallerWizardView })));
const CatalogView = lazy(() => import("./views/CatalogView").then((module) => ({ default: module.CatalogView })));
const RuntimeManagerView = lazy(() => import("./views/RuntimeManagerView").then((module) => ({ default: module.RuntimeManagerView })));
const CompatibilityView = lazy(() => import("./views/CompatibilityView").then((module) => ({ default: module.CompatibilityView })));
const DiagnosticsView = lazy(() => import("./views/DiagnosticsView").then((module) => ({ default: module.DiagnosticsView })));
const SettingsView = lazy(() => import("./views/SettingsView").then((module) => ({ default: module.SettingsView })));
import {
  launchApplication,
  stopApplication,
  toggleFavorite,
  FusionErrorPayload,
} from "./services/tauri";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useLibraryState } from "./hooks/useLibraryState";
import { CreateBottleDialog } from "./components/CreateBottleDialog";
import { ViewBoundary } from "./components/ViewBoundary";
import { JobPanel } from "./components/JobPanel";
import { errorMessage } from "./services/errors";
import { GlobalDropZone } from "./components/GlobalDropZone";
import { DroppedFileModal } from "./components/DroppedFileModal";
import { ToastContainer, ToastItem } from "./components/Toast";

const VIEW_TITLES: Record<ViewId, string> = {
  all_apps: "All Applications",
  favorites: "Favorites",
  catalog: "Game Catalog",
  bottle: "Bottle",
  installer: "Install Windows Application",
  compatibility: "Compatibility Center",
  diagnostics: "Diagnostics & Health",
  runtimes: "Wine Runtimes",
  settings: "Settings",
};

export function App() {
  const [currentView, setCurrentView] = useState<ViewId>("all_apps");
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("fusioncross-theme");
    return (saved as "dark" | "light") || "dark";
  });

  const { state, systemInfo, templates, runningInfo, recoveryNotice, setRecoveryNotice,
    error: syncError, isSyncing, refreshState, pollDynamicState } = useLibraryState();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showCreateBottleModal, setShowCreateBottleModal] = useState(false);

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
    try {
      await refreshState();
      addToast("success", "Application state synchronized successfully.", "Synced");
    } catch (cause) {
      addToast("error", errorMessage(cause, "Synchronization failed."), "Sync Failed");
    }
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
    } catch (cause) {
      addToast("error", errorMessage(cause, "Could not update favorite."));
    }
  };

  const toggleTheme = () => {
    setTheme((prev: "dark" | "light") => (prev === "dark" ? "light" : "dark"));
  };

  const handleSelectBottle = (bottleId: string) => {
    setSelectedBottleId(bottleId);
    setCurrentView("bottle");
  };

  if (!state) {
    return <main className="flex h-screen items-center justify-center bg-(--bg-main) text-(--text-main)">
      <div className="space-y-3 p-6" role={syncError ? "alert" : "status"}>
        <h1>{syncError ? "Your library could not load" : "Loading your library…"}</h1>
        {syncError && <><p>{syncError}</p><button disabled={isSyncing} onClick={handleManualSync} className="underline">{isSyncing ? "Retrying…" : "Retry"}</button></>}
      </div>
    </main>;
  }

  const selectedBottle =
    state.bottles.find((b) => b.id === selectedBottleId) ||
    (state.bottles.length ? state.bottles[0] : null);

  const totalAppsCount = state.applications.length;
  const favoritesCount = state.applications.filter((a) => a.favorite).length;

  return (
    <div className="flex h-screen w-screen bg-(--bg-main) text-(--text-main) font-sans overflow-hidden transition-colors duration-200">
      {/* Left Navigation Sidebar (CrossOver-style master layout) */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        bottles={state?.bottles || []}
        selectedBottleId={selectedBottle?.id || null}
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
        {syncError && <div role="alert" className="border-b border-(--border-color) p-3 text-sm">Updates are unavailable. Showing the last loaded library. {syncError}</div>}
        {recoveryNotice && (
          <div role="alert" className="px-6 py-3 text-sm border-b border-(--border-color) bg-(--bg-surface)">
            <p>{recoveryNotice}</p>
            <button onClick={() => setRecoveryNotice(null)} className="mt-2 underline">Dismiss</button>
          </div>
        )}
        {/* Top Header Bar */}
        <JobPanel onCompleted={refreshState} />
        <header className="h-11 shrink-0 px-6 flex items-center justify-between border-b border-(--border-color) bg-(--bg-glass) backdrop-blur-md text-[13px] font-sans">
          <div className="flex items-center gap-2 text-(--text-muted)">
            <span className="font-semibold text-(--text-main)">
              {currentView === "bottle" && selectedBottle
                ? selectedBottle.name
                : VIEW_TITLES[currentView]}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[12px] font-mono text-(--text-muted)">
            {systemInfo && (
              <span className="hidden sm:inline">
                macOS ·{" "}
                {systemInfo.arch === "aarch64" || systemInfo.arch === "arm64"
                  ? "Apple silicon"
                  : "Intel"}
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

        {systemInfo && systemInfo.wine_path === null && (
          <div className="px-6 py-2 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-2 text-[13px] text-(--text-main)">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="flex-1">
              No Wine runtime found — Windows apps can't launch until one is available.
            </span>
            <button
              onClick={() => setCurrentView("runtimes")}
              className="px-2.5 py-1 rounded-md bg-(--bg-surface) border border-(--border-color) font-semibold hover:bg-(--bg-elevated) transition-colors cursor-pointer shrink-0"
            >
              Set up runtime
            </button>
          </div>
        )}

        {/* Main Content View Switcher */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <ViewBoundary key={currentView}><Suspense fallback={<p role="status" className="p-6">Loading screen…</p>}>
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
              onNotify={addToast}
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
              onNotify={addToast}
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
              winePath={systemInfo ? systemInfo.wine_path : undefined}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              settings={state?.settings || []}
              onRefreshState={refreshState}
              onNotify={addToast}
            />
          )}
          </Suspense></ViewBoundary>
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

      {showCreateBottleModal && <CreateBottleDialog templates={templates} onClose={() => setShowCreateBottleModal(false)} onCreated={(bottle) => {
        setShowCreateBottleModal(false);
        setSelectedBottleId(bottle.id);
        setCurrentView("bottle");
        addToast("success", `Bottle "${bottle.name}" created; initialization is running in the background.`);
        void refreshState().catch((cause) => addToast("error", errorMessage(cause, "Could not refresh your library.")));
      }} />}

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

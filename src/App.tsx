import { useEffect, useState } from "react";
import { Sidebar, ViewId } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { BottleWorkspaceView } from "./views/BottleWorkspaceView";
import { ApplicationsView } from "./views/ApplicationsView";
import { InstallerWizardView } from "./views/InstallerWizardView";
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
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Create Bottle Modal state
  const [showCreateBottleModal, setShowCreateBottleModal] = useState(false);
  const [newBottleName, setNewBottleName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("gaming");
  const [creatingBottle, setCreatingBottle] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("fusioncross-theme", theme);
  }, [theme]);

  const refreshState = async () => {
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
        // Automatically default selectedBottleId if none selected yet
        if (!selectedBottleId && st.bottles.length > 0) {
          setSelectedBottleId(st.bottles[0].id);
        }
      }
      if (tmpl) setTemplates(tmpl);
      if (run) setRunningInfo(run);
      setGlobalError(null);
    } catch (e) {
      setGlobalError((e as FusionErrorPayload).message || String(e));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async polling, setState only fires after await
    refreshState();
    const interval = setInterval(refreshState, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global Hotkey ⌘ K listener for Command Palette (PRD §5)
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

  const handleLaunchApp = async (appId: string) => {
    try {
      await launchApplication(appId);
      await refreshState();
    } catch (e) {
      const err = e as FusionErrorPayload;
      setGlobalError(`Launch failed: ${err.message || "Failed to launch process."}`);
    }
  };

  const handleStopApp = async (appId: string) => {
    try {
      await stopApplication(appId);
      await refreshState();
    } catch (e) {
      const err = e as FusionErrorPayload;
      setGlobalError(`Stop failed: ${err.message || "Failed to stop process."}`);
    }
  };

  const handleToggleFavorite = async (appId: string) => {
    try {
      await toggleFavorite(appId);
      await refreshState();
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
      await refreshState();
    } catch (e) {
      setGlobalError((e as FusionErrorPayload).message || "Failed to create bottle.");
    } finally {
      setCreatingBottle(false);
    }
  };

  const selectedBottle =
    state?.bottles.find((b) => b.id === selectedBottleId) ||
    (state?.bottles.length ? state.bottles[0] : null);

  const totalAppsCount = state?.applications.length || 0;
  const favoritesCount = state?.applications.filter((a) => a.favorite).length || 0;

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans select-none overflow-hidden transition-colors duration-200">
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
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-main)]">
        {/* Top Header Bar */}
        <header className="h-11 shrink-0 px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-md text-[12px] font-sans">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text-main)]">
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

          <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--text-muted)]">
            {systemInfo && (
              <span className="hidden sm:inline">
                macOS {systemInfo.os} · {systemInfo.arch}
              </span>
            )}

            <button
              onClick={refreshState}
              className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1 cursor-pointer"
              title="Refresh State"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {globalError && (
          <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-500 font-mono text-[11px] flex items-center justify-between">
            <span>⚠ {globalError}</span>
            <button onClick={() => setGlobalError(null)} className="hover:underline cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

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
            />
          )}

          {currentView === "installer" && (
            <InstallerWizardView
              bottles={state?.bottles || []}
              onFinish={() => setCurrentView("all_apps")}
              onRefreshState={refreshState}
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
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[var(--accent-primary)]" />
                <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                  Create New Bottle Environment
                </h3>
              </div>
              <button
                onClick={() => setShowCreateBottleModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-[var(--text-muted)] block mb-1">
                  Bottle Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Steam, Cyberpunk 2077, Office 365"
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-[var(--text-muted)] block mb-1">
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
                          ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--text-main)]"
                          : "bg-[var(--bg-elevated)] border-[var(--border-color)] hover:border-[var(--border-hover)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <p className="text-[12px] font-medium">{tmpl.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{tmpl.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateBottleModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBottle}
                disabled={!newBottleName.trim() || creatingBottle}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
              >
                {creatingBottle ? "Creating..." : "Create Bottle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
import { useEffect, useState } from "react";
import { Sidebar, ViewId } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { HomeView } from "./views/HomeView";
import { ApplicationsView } from "./views/ApplicationsView";
import { InstallerWizardView } from "./views/InstallerWizardView";
import { BottlesView } from "./views/BottlesView";
import { RuntimeManagerView } from "./views/RuntimeManagerView";
import { CompatibilityView } from "./views/CompatibilityView";
import { DiagnosticsView } from "./views/DiagnosticsView";
import { SettingsView } from "./views/SettingsView";
import { WebsitePortalView } from "./views/WebsitePortalView";
import {
  getSystemInfo,
  getState,
  getTemplates,
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
import { Moon, Sun, Monitor, Globe, Code2 } from "lucide-react";

export function App() {
  // Default to "website" so visiting localhost:1420 displays the Download & Feature website
  const [currentView, setCurrentView] = useState<ViewId>("website");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("fusioncross-theme");
    return (saved as "dark" | "light") || "dark";
  });

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [templates, setTemplates] = useState<BottleTemplate[]>([]);
  const [runningInfo, setRunningInfo] = useState<RunningInfo[]>([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

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
      if (st) setState(st);
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

  // Dedicated Website Mode (No App sidebar clutter)
  if (currentView === "website") {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
        {/* Website Header */}
        <header className="sticky top-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-xl transition-all">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <a href="#" className="flex items-center gap-3 text-decoration-none group">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[#3b52d4] flex items-center justify-center font-mono font-bold text-[16px] text-white shadow-md shadow-[var(--accent-glow)] group-hover:scale-105 transition-transform">
                F
              </span>
              <div>
                <span className="font-mono font-bold text-[16px] tracking-wider text-[var(--text-main)] block">
                  FUSIONCROSS
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] block">
                  v2.0 MVP · Apple Silicon
                </span>
              </div>
            </a>

            <div className="flex items-center gap-3">
              {/* Desktop App Workspace Switcher */}
              <button
                onClick={() => setCurrentView("home")}
                className="px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] font-mono text-[12px] font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Open Desktop Workspace</span>
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-main)] font-mono text-[12px] font-semibold flex items-center gap-2 hover:border-[var(--border-hover)] transition-all shadow-sm cursor-pointer"
                title="Toggle Dark / Light Theme"
              >
                {theme === "dark" ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-accent-400" />
                    <span>Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Light</span>
                  </>
                )}
              </button>

              {/* GitHub Link */}
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-mono text-[12px] font-bold flex items-center gap-2 shadow-md shadow-[var(--accent-glow)] transition-all text-decoration-none"
              >
                <Code2 className="w-4 h-4" />
                <span>GitHub</span>
              </a>
            </div>
          </div>
        </header>

        {/* Website Landing Page View */}
        <WebsitePortalView onOpenAppWorkbench={() => setCurrentView("home")} />
      </div>
    );
  }

  // Desktop Application Mode (With Sidebar & Workbenches)
  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans select-none overflow-hidden transition-colors duration-300">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        runningCount={runningInfo.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-main)]">
        {/* Top Header Bar */}
        <header className="h-12 shrink-0 px-6 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-glass)] backdrop-blur-xl font-mono text-[11px] transition-all">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <Monitor className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>FUSIONCROSS</span>
              <span>/</span>
              <span className="text-[var(--text-main)] uppercase font-bold tracking-wider">
                {currentView}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {systemInfo && (
              <span className="text-[var(--text-muted)] hidden md:inline">
                macOS {systemInfo.os} · {systemInfo.arch}
              </span>
            )}

            {/* View Download Website Button */}
            <button
              onClick={() => setCurrentView("website")}
              className="px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)] hover:text-[var(--text-main)]"
            >
              <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>View Download Website</span>
            </button>

            {/* Dark / Light Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-elevated)] text-[var(--text-main)] hover:border-[var(--border-hover)] transition-all cursor-pointer"
              title="Toggle Dark / Light Theme"
            >
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5 text-accent-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>

            <button
              onClick={refreshState}
              className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              ↻ Refresh
            </button>
          </div>
        </header>

        {/* Global Error Alert Banner */}
        {globalError && (
          <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/30 text-red-500 font-mono text-[11px] flex items-center justify-between">
            <span>⚠ {globalError}</span>
            <button onClick={() => setGlobalError(null)} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* View Switcher Router */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {currentView === "home" && (
            <HomeView
              systemInfo={systemInfo}
              applications={state?.applications || []}
              bottles={state?.bottles || []}
              runningInfo={runningInfo}
              onNavigate={(v) => setCurrentView(v)}
              onLaunchApp={handleLaunchApp}
              onStopApp={handleStopApp}
            />
          )}

          {currentView === "applications" && (
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

          {currentView === "recent" && (
            <ApplicationsView
              applications={state?.applications || []}
              bottles={state?.bottles || []}
              runningInfo={runningInfo}
              onLaunchApp={handleLaunchApp}
              onStopApp={handleStopApp}
              onToggleFavorite={handleToggleFavorite}
              onNavigate={(v) => setCurrentView(v)}
              filterMode="recent"
            />
          )}

          {currentView === "installer" && (
            <InstallerWizardView
              bottles={state?.bottles || []}
              onFinish={() => setCurrentView("applications")}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "bottles" && (
            <BottlesView
              bottles={state?.bottles || []}
              templates={templates}
              snapshots={state?.snapshots || []}
              onRefreshState={refreshState}
            />
          )}

          {currentView === "runtimes" && (
            <RuntimeManagerView
              runtimes={state?.runtimes || []}
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

          {currentView === "settings" && (
            <SettingsView
              settings={state?.settings || []}
              onRefreshState={refreshState}
            />
          )}
        </div>
      </main>

      {/* Command Palette Overlay (⌘ K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(v) => setCurrentView(v)}
        applications={state?.applications || []}
        bottles={state?.bottles || []}
        runtimes={state?.runtimes || []}
        onLaunchApp={handleLaunchApp}
      />
    </div>
  );
}

export default App;
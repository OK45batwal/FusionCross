import React, { useState } from "react";
import {
  Play,
  Square,
  FolderOpen,
  Terminal,
  Download,
  Power,
  Wrench,
  Camera,
  Copy,
  Trash2,
  Heart,
  ExternalLink,
  Search,
  Sliders,
  CheckCircle,
  X,
  PackagePlus,
} from "lucide-react";
import {
  Application,
  Bottle,
  BottleTemplate,
  RunningInfo,
  Snapshot,
  openBottleCDrive,
  revealInFinder,
  runCommandInBottle,
  killBottleProcesses,
  launchWineTool,
  installBottleVerb,
  repairBottle,
  updateBottle,
  cloneBottle,
  deleteBottle,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  exportAppBundle,
  FusionErrorPayload,
} from "../services/tauri";

interface BottleWorkspaceViewProps {
  bottle: Bottle;
  applications: Application[];
  runningInfo: RunningInfo[];
  templates: BottleTemplate[];
  snapshots: Snapshot[];
  onLaunchApp: (appId: string) => void;
  onStopApp: (appId: string) => void;
  onToggleFavorite: (appId: string) => void;
  onRefreshState: () => void;
  onOpenInstaller: (bottleId: string) => void;
  onBottleDeleted: () => void;
  onSelectBottle: (bottleId: string) => void;
}

export const BottleWorkspaceView: React.FC<BottleWorkspaceViewProps> = ({
  bottle,
  applications,
  runningInfo,
  snapshots,
  onLaunchApp,
  onStopApp,
  onToggleFavorite,
  onRefreshState,
  onOpenInstaller,
  onBottleDeleted,
  onSelectBottle,
}) => {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showRunCommandModal, setShowRunCommandModal] = useState(false);
  const [runCmdInput, setRunCmdInput] = useState("");
  const [runCmdArgs, setRunCmdArgs] = useState("");

  const [showWinetricksModal, setShowWinetricksModal] = useState(false);
  const [customVerb, setCustomVerb] = useState("");
  const [installingVerb, setInstallingVerb] = useState(false);

  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState(`${bottle.name} (Copy)`);

  // Filter apps belonging to this bottle
  const bottleApps = applications.filter((a) => a.bottle_id === bottle.id);
  const filteredApps = bottleApps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const runningAppsInBottle = runningInfo.filter((r) => r.bottle_id === bottle.id);
  const isBottleRunning = runningAppsInBottle.length > 0;

  // Handlers
  const handleOpenCDrive = async () => {
    try {
      await openBottleCDrive(bottle.id);
      setNotice(`Opened C: Drive for "${bottle.name}" in Finder.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to open C: Drive.");
    }
  };

  const handleStopAll = async () => {
    try {
      await killBottleProcesses(bottle.id);
      onRefreshState();
      setNotice(`All processes stopped for "${bottle.name}".`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to stop processes.");
    }
  };

  const handleRunCommand = async () => {
    if (!runCmdInput.trim()) return;
    try {
      const args = runCmdArgs.trim() ? runCmdArgs.trim().split(" ") : [];
      await runCommandInBottle(bottle.id, runCmdInput.trim(), args);
      setShowRunCommandModal(false);
      setRunCmdInput("");
      setRunCmdArgs("");
      setNotice(`Launched "${runCmdInput}" inside "${bottle.name}".`);
      onRefreshState();
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to run command.");
    }
  };

  const handleToggleSetting = async (
    key: "msync_enabled" | "performance_hud" | "retina_mode" | "dxvk_enabled",
    currentVal: boolean
  ) => {
    try {
      await updateBottle(bottle.id, { [key]: !currentVal });
      onRefreshState();
      setNotice(`Updated ${key.replace("_", " ")} setting.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update setting.");
    }
  };

  const handleGraphicsChange = async (graphics: string) => {
    try {
      const dxvk = graphics === "dxvk" || graphics === "d3dmetal" || graphics === "dxmt";
      await updateBottle(bottle.id, { graphics, dxvk_enabled: dxvk });
      onRefreshState();
      setNotice(`Graphics engine changed to ${graphics.toUpperCase()}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update graphics.");
    }
  };

  const handleLaunchTool = async (tool: string) => {
    try {
      await launchWineTool(bottle.id, tool);
      setNotice(`Launched ${tool}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || `Failed to launch ${tool}.`);
    }
  };

  const handleInstallVerb = async (verb: string) => {
    if (!verb.trim()) return;
    setInstallingVerb(true);
    try {
      await installBottleVerb(bottle.id, verb.trim());
      setCustomVerb("");
      onRefreshState();
      setNotice(`Started installation of "${verb}".`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || `Failed to install ${verb}.`);
    } finally {
      setInstallingVerb(false);
    }
  };

  const handleRepair = async () => {
    try {
      await repairBottle(bottle.id);
      setNotice("Bottle prefix files verified and repaired.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Repair failed.");
    }
  };

  const handleClone = async () => {
    if (!cloneName.trim()) return;
    try {
      const cloned = await cloneBottle(bottle.id, cloneName.trim());
      setShowCloneModal(false);
      onRefreshState();
      onSelectBottle(cloned.id);
      setNotice(`Cloned bottle as "${cloned.name}".`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Clone failed.");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${bottle.name}"? All installed programs and saves in this bottle will be permanently removed.`
      )
    )
      return;
    try {
      await deleteBottle(bottle.id);
      onRefreshState();
      onBottleDeleted();
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Delete failed.");
    }
  };

  const handleExportApp = async (appId: string, appName: string) => {
    try {
      const path = await exportAppBundle(appId);
      setNotice(`Exported macOS app bundle for "${appName}" to ${path}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Export failed.");
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await revealInFinder(path);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Reveal failed.");
    }
  };

  const handleCreateSnapshot = async () => {
    if (!newSnapshotName.trim()) return;
    try {
      await createSnapshot(bottle.id, newSnapshotName.trim());
      setNewSnapshotName("");
      onRefreshState();
      setNotice("Snapshot created successfully.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to create snapshot.");
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    if (!confirm("Restoring this snapshot will overwrite current prefix files. Proceed?")) return;
    try {
      await restoreSnapshot(id);
      onRefreshState();
      setNotice("Snapshot restored.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to restore snapshot.");
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await deleteSnapshot(id);
      onRefreshState();
      setNotice("Snapshot deleted.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to delete snapshot.");
    }
  };

  const bottleSnapshots = snapshots.filter((s) => s.bottle_id === bottle.id);

  return (
    <div className="flex-1 flex overflow-hidden bg-[var(--bg-main)]">
      {/* Center Main Stage (Bottle Header + Applications) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Bottle Master Toolbar / Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[18px] font-semibold text-[var(--text-main)] truncate tracking-tight">
                  {bottle.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                    isBottleRunning
                      ? "bg-[var(--color-ok-glow)] text-[var(--color-ok)] border-[var(--color-ok)]/30"
                      : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-color)]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isBottleRunning ? "bg-[var(--color-ok)] animate-pulse" : "bg-[var(--text-muted)]"
                    }`}
                  />
                  {isBottleRunning ? `Running (${runningAppsInBottle.length})` : "Ready"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[var(--text-muted)]">
                <span>{bottle.windows_version}</span>
                <span>·</span>
                <span>{bottle.graphics.toUpperCase()}</span>
                {bottle.msync_enabled && (
                  <>
                    <span>·</span>
                    <span className="text-[var(--accent-primary)] font-semibold">MSync Active</span>
                  </>
                )}
                {bottle.retina_mode && (
                  <>
                    <span>·</span>
                    <span>Retina HiDPI</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowRunCommandModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Run an arbitrary command or Windows executable inside this bottle"
              >
                <Terminal className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Run Command...</span>
              </button>

              <button
                onClick={handleOpenCDrive}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open the bottle's virtual C: Drive in macOS Finder"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Open C: Drive</span>
              </button>

              <button
                onClick={() => onOpenInstaller(bottle.id)}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="Install Windows software directly into this bottle"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install Software</span>
              </button>

              {isBottleRunning && (
                <button
                  onClick={handleStopAll}
                  className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Force stop all running programs and Wineserver for this bottle"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Stop Bottle</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {notice && (
          <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 text-[11px] font-mono flex items-center justify-between">
            <span>✓ {notice}</span>
            <button onClick={() => setNotice(null)} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-500 text-[11px] font-mono flex items-center justify-between">
            <span>⚠ {error}</span>
            <button onClick={() => setError(null)} className="hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Applications List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[13px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Installed Applications ({bottleApps.length})
            </h2>

            {bottleApps.length > 0 && (
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter programs in bottle..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            )}
          </div>

          {bottleApps.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl border border-dashed border-[var(--border-color)] p-12 text-center flex flex-col items-center justify-center space-y-3 bg-[var(--bg-surface)]/50">
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
                <PackagePlus className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                  No programs installed in {bottle.name}
                </h3>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                  Drag & drop any Windows installer (<span className="font-mono text-[var(--text-main)]">.exe</span>, <span className="font-mono text-[var(--text-main)]">.msi</span>) anywhere into this window, or choose an option below.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => onOpenInstaller(bottle.id)}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Software</span>
                </button>
                <button
                  onClick={() => setShowRunCommandModal(true)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Run Command</span>
                </button>
              </div>
            </div>
          ) : (
            /* Applications Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredApps.map((app) => {
                const isRunning = runningInfo.some((r) => r.app_id === app.id);
                return (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] transition-all flex flex-col justify-between space-y-3 group shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center font-bold text-[14px] text-[var(--accent-primary)] shrink-0">
                          {app.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[var(--text-main)] truncate">
                            {app.name}
                          </p>
                          <p className="text-[11px] font-mono text-[var(--text-muted)] capitalize truncate">
                            {app.category}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleFavorite(app.id)}
                        title={app.favorite ? "Favorited" : "Add to favorites"}
                        className={`p-1 rounded hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer ${
                          app.favorite ? "text-rose-500" : "text-[var(--text-muted)]"
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>Played {app.launch_count} times</span>
                      {isRunning ? (
                        <button
                          onClick={() => onStopApp(app.id)}
                          className="px-3 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Square className="w-3 h-3 fill-current" /> Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => onLaunchApp(app.id)}
                          className="px-3 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-medium flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" /> Launch
                        </button>
                      )}
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-[var(--text-muted)]">
                      <button
                        onClick={() => handleExportApp(app.id, app.name)}
                        className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Create macOS .app launcher in ~/Applications/FusionCross"
                      >
                        <ExternalLink className="w-3 h-3" /> Export Mac App
                      </button>
                      <span>·</span>
                      <button
                        onClick={() => handleReveal(app.executable_path)}
                        className="hover:text-[var(--text-main)] transition-colors flex items-center gap-1 cursor-pointer"
                        title="Reveal in macOS Finder"
                      >
                        <FolderOpen className="w-3 h-3" /> Finder
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Inspector Panel (CrossOver's Control Panels & Settings) */}
      <aside className="w-[300px] shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-surface)] flex flex-col overflow-y-auto select-none transition-colors duration-200">
        <div className="p-4 border-b border-[var(--border-color)]">
          <h2 className="text-[12px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>Bottle Settings</span>
          </h2>
        </div>

        <div className="p-4 space-y-6 flex-1 text-[12px]">
          {/* Graphics Translation Engine */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Graphics Backend
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["d3dmetal", "dxvk", "dxmt", "wined3d"] as const).map((g) => {
                const isCurrent = bottle.graphics === g;
                return (
                  <button
                    key={g}
                    onClick={() => handleGraphicsChange(g)}
                    className={`py-1.5 px-2 rounded-md font-mono text-[11px] text-center border transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[var(--accent-primary)] text-white font-semibold border-[var(--accent-primary)] shadow-xs"
                        : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--border-hover)]"
                    }`}
                  >
                    {g === "d3dmetal" ? "D3DMetal (GPTK)" : g.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Hardware & Optimization Toggles */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Optimizations
            </label>

            {/* MSync Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <div>
                <p className="font-medium text-[12px] text-[var(--text-main)]">MSync (Mach Sync)</p>
                <p className="text-[10px] text-[var(--text-muted)]">Darwin kernel semaphores</p>
              </div>
              <button
                onClick={() => handleToggleSetting("msync_enabled", bottle.msync_enabled)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.msync_enabled ? "bg-[var(--accent-primary)]" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    bottle.msync_enabled ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Performance HUD Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <div>
                <p className="font-medium text-[12px] text-[var(--text-main)]">Performance HUD</p>
                <p className="text-[10px] text-[var(--text-muted)]">Metal FPS & frametimes overlay</p>
              </div>
              <button
                onClick={() => handleToggleSetting("performance_hud", bottle.performance_hud)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.performance_hud ? "bg-[var(--accent-primary)]" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    bottle.performance_hud ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>

            {/* Retina Mode Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
              <div>
                <p className="font-medium text-[12px] text-[var(--text-main)]">High-Resolution (Retina)</p>
                <p className="text-[10px] text-[var(--text-muted)]">DPI scaling for Retina displays</p>
              </div>
              <button
                onClick={() => handleToggleSetting("retina_mode", bottle.retina_mode)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.retina_mode ? "bg-[var(--accent-primary)]" : "bg-zinc-600"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    bottle.retina_mode ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Control Panels & Wine Tools (CrossOver Standard) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Control Panels & Tools
            </label>
            <div className="space-y-1">
              {[
                { id: "winecfg", label: "Wine Configuration" },
                { id: "regedit", label: "Registry Editor" },
                { id: "taskmgr", label: "Wine Task Manager" },
                { id: "control", label: "Control Panel" },
                { id: "cmd", label: "Command Prompt" },
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => handleLaunchTool(tool.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-color)]"
                >
                  <span>{tool.label}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{tool.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bottle Maintenance Actions */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)]">
            <label className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
              Maintenance
            </label>
            <div className="space-y-1">
              <button
                onClick={() => setShowWinetricksModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Install Dependencies...</span>
              </button>

              <button
                onClick={() => setShowSnapshotsModal(true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Snapshots & Restore</span>
                </div>
                {bottleSnapshots.length > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded bg-[var(--bg-elevated)]">
                    {bottleSnapshots.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowCloneModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Duplicate Bottle...</span>
              </button>

              <button
                onClick={handleRepair}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Repair Prefix</span>
              </button>

              <button
                onClick={handleDelete}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Bottle</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Modal: Run Command */}
      {showRunCommandModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                Run Command in {bottle.name}
              </h3>
              <button
                onClick={() => setShowRunCommandModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-[var(--text-muted)] block mb-1">
                  Command or Executable
                </label>
                <input
                  type="text"
                  placeholder="e.g. notepad.exe, dxdiag.exe, C:\Games\game.exe"
                  value={runCmdInput}
                  onChange={(e) => setRunCmdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-[var(--text-muted)] block mb-1">
                  Arguments (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. -windowed -dx12"
                  value={runCmdArgs}
                  onChange={(e) => setRunCmdArgs(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRunCommandModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRunCommand}
                disabled={!runCmdInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Winetricks Dependencies */}
      {showWinetricksModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                Install Windows Components ({bottle.name})
              </h3>
              <button
                onClick={() => setShowWinetricksModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12px] text-[var(--text-muted)]">
              Select standard Windows runtime components to install into this bottle:
            </p>

            {/* Popular Verbs Chips */}
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 p-1">
              {[
                { verb: "vcrun2022", label: "Visual C++ 2015-2022", desc: "Required for modern games" },
                { verb: "dotnet48", label: ".NET Framework 4.8", desc: "For launchers & tools" },
                { verb: "d3dcompiler_47", label: "D3DCompiler 47", desc: "HLSL Shader compilation" },
                { verb: "corefonts", label: "Microsoft TrueType Fonts", desc: "Arial, Times, Courier" },
                { verb: "directx9", label: "DirectX End-User Runtimes", desc: "Legacy DirectX libraries" },
                { verb: "msxml6", label: "MSXML 6.0 Parser", desc: "XML data processing" },
              ].map((item) => {
                const isInstalled = bottle.dependencies.includes(item.verb);
                return (
                  <div
                    key={item.verb}
                    className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <p className="font-medium text-[12px] text-[var(--text-main)]">{item.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                    {isInstalled ? (
                      <span className="text-[11px] font-mono text-[var(--color-ok)] flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInstallVerb(item.verb)}
                        disabled={installingVerb}
                        className="w-full py-1 rounded bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Install
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Verb Input */}
            <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
              <label className="text-[11px] font-mono text-[var(--text-muted)] block">
                Custom Winetricks Verb
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. xna40, mfc42, physx"
                  value={customVerb}
                  onChange={(e) => setCustomVerb(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] focus:outline-none"
                />
                <button
                  onClick={() => handleInstallVerb(customVerb)}
                  disabled={!customVerb.trim() || installingVerb}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
                >
                  Install Verb
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Snapshots */}
      {showSnapshotsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                Bottle Snapshots ({bottle.name})
              </h3>
              <button
                onClick={() => setShowSnapshotsModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Create Snapshot Form */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Snapshot label (e.g. Fresh Win10 clean state)"
                value={newSnapshotName}
                onChange={(e) => setNewSnapshotName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] text-[var(--text-main)] focus:outline-none"
              />
              <button
                onClick={handleCreateSnapshot}
                disabled={!newSnapshotName.trim()}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Save State</span>
              </button>
            </div>

            {/* List of Snapshots */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-60 pt-2">
              {bottleSnapshots.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] italic text-center py-6">
                  No snapshots created yet.
                </p>
              ) : (
                bottleSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-[12px] text-[var(--text-main)]">{snap.name}</p>
                      <p className="text-[10px] font-mono text-[var(--text-muted)]">
                        {(snap.size_bytes / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        className="px-2.5 py-1 rounded bg-[var(--bg-surface)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[11px] font-medium text-[var(--text-main)] cursor-pointer"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDeleteSnapshot(snap.id)}
                        className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clone Bottle */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[var(--text-main)]">
                Duplicate {bottle.name}
              </h3>
              <button
                onClick={() => setShowCloneModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-[var(--text-muted)] block">
                New Bottle Name
              </label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCloneModal(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!cloneName.trim()}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-medium cursor-pointer"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

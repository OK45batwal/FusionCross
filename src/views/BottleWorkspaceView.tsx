import React, { useState, useEffect } from "react";
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
  RefreshCw,
  Zap,
  MoreVertical,
  FileText,
} from "lucide-react";
import {
  Application,
  Bottle,
  BottleTemplate,
  RunningInfo,
  Snapshot,
  LogEntry,
  openBottleCDrive,
  revealInFinder,
  runCommandInBottle,
  killBottleProcesses,
  launchWineTool,
  installBottleVerb,
  installGamingEssentials,
  repairBottle,
  updateBottle,
  cloneBottle,
  deleteBottle,
  createSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  exportAppBundle,
  scanBottle,
  unregisterApplication,
  listApplicationLogs,
  readLogFile,
  openLogsDirectory,
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
  const [verbSearch, setVerbSearch] = useState("");

  const [showSnapshotsModal, setShowSnapshotsModal] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");

  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState(`${bottle.name} (Copy)`);
  const [scanning, setScanning] = useState(false);
  const [installingEssentials, setInstallingEssentials] = useState(false);
  const [menuAppId, setMenuAppId] = useState<string | null>(null);

  useEffect(() => {
    const handleCloseMenu = () => setMenuAppId(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  // Filter apps belonging to this bottle
  const bottleApps = applications.filter((a) => a.bottle_id === bottle.id);
  const filteredApps = bottleApps.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const runningAppsInBottle = runningInfo.filter((r) => r.bottle_id === bottle.id);
  const isBottleRunning = runningAppsInBottle.length > 0;

  // Handlers
  const handleInstallEssentials = async () => {
    setInstallingEssentials(true);
    setError(null);
    setNotice(null);
    try {
      const res = await installGamingEssentials(bottle.id);
      setNotice(res);
      await onRefreshState();
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to install gaming essentials.");
    } finally {
      setInstallingEssentials(false);
    }
  };

  const handleScanBottle = async () => {
    setScanning(true);
    try {
      await scanBottle(bottle.id);
      await onRefreshState();
      setNotice(`Scanned "${bottle.name}" and refreshed applications.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to scan bottle for programs.");
    } finally {
      setScanning(false);
    }
  };

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

  const [confirmDeleteBottle, setConfirmDeleteBottle] = useState(false);
  const [confirmDeleteSnapshotId, setConfirmDeleteSnapshotId] = useState<string | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [bottleLogs, setBottleLogs] = useState<LogEntry[]>([]);
  const [selectedLogPath, setSelectedLogPath] = useState<string | null>(null);
  const [selectedLogContent, setSelectedLogContent] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const handleOpenLogs = async () => {
    setShowLogsModal(true);
    setLoadingLogs(true);
    try {
      const logs = await listApplicationLogs();
      const appIds = new Set(bottleApps.map((a) => a.id));
      const relevant = logs.filter((l) => {
        const prefix = l.filename.split("_")[0];
        return appIds.has(prefix);
      });
      const listToUse = relevant.length > 0 ? relevant : logs;
      setBottleLogs(listToUse);
      if (listToUse.length > 0 && listToUse[0]) {
        await handleSelectLog(listToUse[0].path);
      } else {
        setSelectedLogContent("No execution logs recorded yet for this bottle.");
      }
    } catch {
      setError("Failed to load application logs.");
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSelectLog = async (path: string) => {
    setSelectedLogPath(path);
    try {
      const text = await readLogFile(path);
      setSelectedLogContent(text);
    } catch {
      setSelectedLogContent("Failed to read log file.");
    }
  };

  const handleDelete = () => {
    setConfirmDeleteBottle(true);
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

  const handleUnregisterApp = async (appId: string, appName: string) => {
    try {
      await unregisterApplication(appId);
      await onRefreshState();
      setNotice(`Removed "${appName}" from library.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to remove application.");
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

  const handleDeleteSnapshot = (id: string) => {
    setConfirmDeleteSnapshotId(id);
  };

  const bottleSnapshots = snapshots.filter((s) => s.bottle_id === bottle.id);

  return (
    <div className="flex-1 flex overflow-hidden bg-(--bg-main)">
      {/* Center Main Stage (Bottle Header + Applications) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Bottle Master Toolbar / Header */}
        <div className="px-6 py-4 border-b border-(--border-color) bg-(--bg-surface) shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[18px] font-semibold text-(--text-main) truncate tracking-tight">
                  {bottle.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                    isBottleRunning
                      ? "bg-(--color-ok-glow) text-ok border-ok/30"
                      : "bg-(--bg-elevated) text-(--text-muted) border-(--border-color)"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isBottleRunning ? "bg-ok animate-pulse" : "bg-(--text-muted)"
                    }`}
                  />
                  {isBottleRunning ? `Running (${runningAppsInBottle.length})` : "Ready"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-(--text-muted)">
                <span>{bottle.windows_version}</span>
                <span>·</span>
                <span>{bottle.graphics.toUpperCase()}</span>
                {bottle.msync_enabled && (
                  <>
                    <span>·</span>
                    <span className="text-(--accent-primary) font-semibold">MSync Active</span>
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
                className="px-3 py-1.5 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Run an arbitrary command or Windows executable inside this bottle"
              >
                <Terminal className="w-3.5 h-3.5 text-(--accent-primary)" />
                <span>Run Command...</span>
              </button>

              <button
                onClick={handleOpenCDrive}
                className="px-3 py-1.5 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open the bottle's virtual C: Drive in macOS Finder"
              >
                <FolderOpen className="w-3.5 h-3.5 text-(--accent-primary)" />
                <span>Open C: Drive</span>
              </button>

              <button
                onClick={() => onOpenInstaller(bottle.id)}
                className="px-3 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[12px] font-medium flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
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
            <h2 className="text-[13px] font-mono uppercase tracking-wider text-(--text-muted) font-semibold">
              Installed Applications ({bottleApps.length})
            </h2>

            <div className="flex items-center gap-2">
              <button
                onClick={handleScanBottle}
                disabled={scanning}
                className="px-2.5 py-1 rounded-md bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Scan prefix for installed .exe files"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-(--accent-primary) ${scanning ? "animate-spin" : ""}`} />
                <span>{scanning ? "Scanning..." : "Scan for Apps"}</span>
              </button>

              {bottleApps.length > 0 && (
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Filter programs in bottle..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 rounded-md bg-(--bg-elevated) border border-(--border-color) text-[12px] text-(--text-main) placeholder-(--text-muted) focus:outline-none focus:border-(--accent-primary)"
                  />
                </div>
              )}
            </div>
          </div>

          {bottleApps.length === 0 ? (
            /* Empty State */
            <div className="rounded-xl border border-dashed border-(--border-color) p-12 text-center flex flex-col items-center justify-center space-y-3 bg-(--bg-surface)/50">
              <div className="w-12 h-12 rounded-xl bg-(--bg-elevated) border border-(--border-color) flex items-center justify-center text-(--text-muted)">
                <PackagePlus className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-[14px] font-semibold text-(--text-main)">
                  No programs installed in {bottle.name}
                </h3>
                <p className="text-[12px] text-(--text-muted) leading-relaxed">
                  Drag & drop any Windows installer (<span className="font-mono text-(--text-main)">.exe</span>, <span className="font-mono text-(--text-main)">.msi</span>) anywhere into this window, or choose an option below.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => onOpenInstaller(bottle.id)}
                  className="px-4 py-2 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[12px] font-medium flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Software</span>
                </button>
                <button
                  onClick={handleScanBottle}
                  disabled={scanning}
                  className="px-4 py-2 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                  <span>{scanning ? "Scanning..." : "Scan Bottle"}</span>
                </button>
                <button
                  onClick={() => setShowRunCommandModal(true)}
                  className="px-4 py-2 rounded-lg bg-(--bg-elevated) hover:bg-(--border-color) border border-(--border-color) text-(--text-main) text-[12px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Run Command</span>
                </button>
              </div>
            </div>
          ) : (
            /* CrossOver Native Application Shelf (Icon Grid) */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-2">
              {filteredApps.map((app) => {
                const isRunning = runningInfo.some((r) => r.app_id === app.id);
                const isMenuOpen = menuAppId === app.id;
                return (
                  <div
                    key={app.id}
                    onDoubleClick={() => onLaunchApp(app.id)}
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
                      {isRunning && (
                        <span
                          title="Application is running"
                          className="absolute top-1 right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-(--bg-surface) shadow-xs animate-pulse"
                        />
                      )}

                      {/* Hover Quick Launch Scrim */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRunning) {
                            onStopApp(app.id);
                          } else {
                            onLaunchApp(app.id);
                          }
                        }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                        title={isRunning ? "Stop Application" : "Launch Application"}
                      >
                        {isRunning ? (
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
                      <p className="text-[10px] font-mono text-(--text-muted) capitalize truncate mt-0.5">
                        {app.category}
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
                          {isRunning ? (
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
                            onClick={() => {
                              handleExportApp(app.id, app.name);
                              setMenuAppId(null);
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
                              handleUnregisterApp(app.id, app.name);
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
          )}
        </div>
      </div>

      {/* Right Inspector Panel (CrossOver's Control Panels & Settings) */}
      <aside className="w-75 shrink-0 border-l border-(--border-color) bg-(--bg-surface) flex flex-col overflow-y-auto select-none transition-colors duration-200">
        <div className="p-4 border-b border-(--border-color)">
          <h2 className="text-[12px] font-mono uppercase tracking-wider text-(--text-muted) font-semibold flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-(--accent-primary)" />
            <span>Bottle Settings</span>
          </h2>
        </div>

        <div className="p-4 space-y-6 flex-1 text-[12px]">
          {/* Graphics Translation Engine */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono text-(--text-muted) uppercase tracking-wider block">
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
                        ? "bg-(--accent-primary) text-white font-semibold border-(--accent-primary) shadow-xs"
                        : "bg-(--bg-elevated) text-(--text-secondary) border-(--border-color) hover:border-(--border-hover)"
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
            <label className="text-[11px] font-mono text-(--text-muted) uppercase tracking-wider block">
              Optimizations
            </label>

            {/* MSync Toggle */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-(--bg-elevated) border border-(--border-color)">
              <div>
                <p className="font-medium text-[12px] text-(--text-main)">MSync (Mach Sync)</p>
                <p className="text-[10px] text-(--text-muted)">Darwin kernel semaphores</p>
              </div>
              <button
                onClick={() => handleToggleSetting("msync_enabled", bottle.msync_enabled)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.msync_enabled ? "bg-(--accent-primary)" : "bg-zinc-600"
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
            <div className="flex items-center justify-between p-2 rounded-lg bg-(--bg-elevated) border border-(--border-color)">
              <div>
                <p className="font-medium text-[12px] text-(--text-main)">Performance HUD</p>
                <p className="text-[10px] text-(--text-muted)">Metal FPS & frametimes overlay</p>
              </div>
              <button
                onClick={() => handleToggleSetting("performance_hud", bottle.performance_hud)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.performance_hud ? "bg-(--accent-primary)" : "bg-zinc-600"
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
            <div className="flex items-center justify-between p-2 rounded-lg bg-(--bg-elevated) border border-(--border-color)">
              <div>
                <p className="font-medium text-[12px] text-(--text-main)">High-Resolution (Retina)</p>
                <p className="text-[10px] text-(--text-muted)">DPI scaling for Retina displays</p>
              </div>
              <button
                onClick={() => handleToggleSetting("retina_mode", bottle.retina_mode)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  bottle.retina_mode ? "bg-(--accent-primary)" : "bg-zinc-600"
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
            <label className="text-[11px] font-mono text-(--text-muted) uppercase tracking-wider block">
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
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer border border-transparent hover:border-(--border-color)"
                >
                  <span>{tool.label}</span>
                  <span className="font-mono text-[10px] text-(--text-muted)">{tool.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gaming Essentials 1-Click Installer */}
          <div className="p-3 rounded-xl bg-linear-to-br from-(--accent-primary)/10 via-(--bg-elevated) to-(--bg-elevated) border border-(--accent-primary)/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[12px] text-(--text-main) flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-(--accent-primary) fill-current" /> Gaming Essentials
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-(--accent-primary)/20 text-(--accent-primary) font-semibold">1-Click</span>
            </div>
            <p className="text-[11px] text-(--text-muted) leading-relaxed">
              Installs DirectX 9, VC++ 2015-2022 runtimes, and CoreFonts to prevent DLL launch crashes.
            </p>
            <button
              onClick={handleInstallEssentials}
              disabled={installingEssentials}
              className="w-full py-1.5 px-3 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-mono font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {installingEssentials ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Installing Runtimes...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install Essentials</span>
                </>
              )}
            </button>
          </div>

          {/* Bottle Maintenance Actions */}
          <div className="space-y-1.5 pt-2 border-t border-(--border-color)">
            <label className="text-[11px] font-mono text-(--text-muted) uppercase tracking-wider block">
              Maintenance
            </label>
            <div className="space-y-1">
              <button
                onClick={() => setShowWinetricksModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5 text-(--text-muted)" />
                <span>Install Dependencies...</span>
              </button>

              <button
                onClick={() => setShowSnapshotsModal(true)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-(--text-muted)" />
                  <span>Snapshots & Restore</span>
                </div>
                {bottleSnapshots.length > 0 && (
                  <span className="text-[10px] font-mono px-1 rounded bg-(--bg-elevated)">
                    {bottleSnapshots.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowCloneModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-(--text-muted)" />
                <span>Duplicate Bottle...</span>
              </button>

              <button
                onClick={handleRepair}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-(--text-muted)" />
                <span>Repair Prefix</span>
              </button>

              <button
                onClick={handleOpenLogs}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-(--text-secondary) hover:text-(--text-main) hover:bg-(--bg-elevated) transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-(--text-muted)" />
                <span>View Bottle Logs...</span>
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
          <div className="w-full max-w-md rounded-xl bg-(--bg-surface) border border-(--border-color) p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-(--text-main)">
                Run Command in {bottle.name}
              </h3>
              <button
                onClick={() => setShowRunCommandModal(false)}
                className="text-(--text-muted) hover:text-(--text-main) cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-(--text-muted) block mb-1">
                  Command or Executable
                </label>
                <input
                  type="text"
                  placeholder="e.g. notepad.exe, dxdiag.exe, C:\Games\game.exe"
                  value={runCmdInput}
                  onChange={(e) => setRunCmdInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] font-mono text-(--text-main) focus:outline-none focus:border-(--accent-primary)"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-(--text-muted) block mb-1">
                  Arguments (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. -windowed -dx12"
                  value={runCmdArgs}
                  onChange={(e) => setRunCmdArgs(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] font-mono text-(--text-main) focus:outline-none focus:border-(--accent-primary)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRunCommandModal(false)}
                className="px-3 py-1.5 rounded-lg border border-(--border-color) text-[12px] font-medium text-(--text-secondary) hover:bg-(--bg-elevated) cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRunCommand}
                disabled={!runCmdInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
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
          <div className="w-full max-w-lg rounded-xl bg-(--bg-surface) border border-(--border-color) p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-(--text-main)">
                Install Windows Components ({bottle.name})
              </h3>
              <button
                onClick={() => setShowWinetricksModal(false)}
                className="text-(--text-muted) hover:text-(--text-main) cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[12px] text-(--text-muted)">
              Select standard Windows runtime components to install into this bottle:
            </p>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-(--text-muted)" />
              <input
                type="text"
                placeholder="Search components (e.g. vcrun, dotnet, directx, fonts)..."
                value={verbSearch}
                onChange={(e) => setVerbSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] text-(--text-main)"
              />
            </div>

            {/* Verbs Grid */}
            <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 p-1 max-h-[45vh]">
              {[
                { verb: "vcrun2022", label: "Visual C++ 2015-2022", desc: "Required for modern games" },
                { verb: "vcrun2019", label: "Visual C++ 2019", desc: "MSVC runtime 2019" },
                { verb: "vcrun2015", label: "Visual C++ 2015", desc: "MSVC runtime 2015" },
                { verb: "vcrun2013", label: "Visual C++ 2013", desc: "MSVC runtime 2013" },
                { verb: "vcrun2010", label: "Visual C++ 2010", desc: "MSVC runtime 2010" },
                { verb: "vcrun2008", label: "Visual C++ 2008", desc: "MSVC runtime 2008" },
                { verb: "dotnet48", label: ".NET Framework 4.8", desc: "For modern launchers & tools" },
                { verb: "dotnet472", label: ".NET Framework 4.7.2", desc: "Targeted by many game mod tools" },
                { verb: "dotnet40", label: ".NET Framework 4.0", desc: "Legacy Windows launchers" },
                { verb: "dotnet35", label: ".NET Framework 3.5", desc: "2.0 and 3.5 runtime" },
                { verb: "d3dcompiler_47", label: "D3DCompiler 47", desc: "HLSL Shader compilation" },
                { verb: "d3dcompiler_43", label: "D3DCompiler 43", desc: "DirectX 9/10 shader support" },
                { verb: "d3dx9", label: "DirectX 9 Helper Dlls", desc: "Essential legacy D3D9 libraries" },
                { verb: "d3dx10", label: "DirectX 10 Helper Dlls", desc: "D3DX10 runtime libraries" },
                { verb: "d3dx11", label: "DirectX 11 Helper Dlls", desc: "D3DX11 runtime libraries" },
                { verb: "corefonts", label: "Microsoft TrueType Fonts", desc: "Arial, Times, Courier, etc." },
                { verb: "tahoma", label: "Tahoma & MS Sans Serif", desc: "UI fonts for older launchers" },
                { verb: "directx9", label: "DirectX End-User Runtimes", desc: "Full DirectX redistributable" },
                { verb: "msxml6", label: "MSXML 6.0 Parser", desc: "XML data processing" },
                { verb: "openal", label: "OpenAL 3D Audio", desc: "3D positional sound runtime" },
                { verb: "physx", label: "NVIDIA PhysX Runtime", desc: "Hardware physics acceleration" },
                { verb: "xna40", label: "Microsoft XNA 4.0", desc: "For XNA-based indie games" },
              ]
                .filter(
                  (item) =>
                    item.verb.toLowerCase().includes(verbSearch.toLowerCase()) ||
                    item.label.toLowerCase().includes(verbSearch.toLowerCase()) ||
                    item.desc.toLowerCase().includes(verbSearch.toLowerCase())
                )
                .map((item) => {
                  const isInstalled = bottle.dependencies.includes(item.verb);
                  return (
                    <div
                      key={item.verb}
                      className="p-3 rounded-lg border border-(--border-color) bg-(--bg-elevated) flex flex-col justify-between space-y-2"
                    >
                      <div>
                        <p className="font-medium text-[12px] text-(--text-main)">{item.label}</p>
                        <p className="text-[10px] text-(--text-muted)">{item.desc}</p>
                      </div>
                      {isInstalled ? (
                        <span className="text-[11px] font-mono text-ok flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleInstallVerb(item.verb)}
                          disabled={installingVerb}
                          className="w-full py-1 rounded bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                        >
                          Install
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Custom Verb Input */}
            <div className="pt-2 border-t border-(--border-color) space-y-2">
              <label className="text-[11px] font-mono text-(--text-muted) block">
                Custom Winetricks Verb
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. xna40, mfc42, physx"
                  value={customVerb}
                  onChange={(e) => setCustomVerb(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] font-mono text-(--text-main) focus:outline-none"
                />
                <button
                  onClick={() => handleInstallVerb(customVerb)}
                  disabled={!customVerb.trim() || installingVerb}
                  className="px-3 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) disabled:opacity-50 text-white text-[12px] font-medium cursor-pointer"
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
          <div className="w-full max-w-lg rounded-xl bg-(--bg-surface) border border-(--border-color) p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-(--text-main)">
                Bottle Snapshots ({bottle.name})
              </h3>
              <button
                onClick={() => setShowSnapshotsModal(false)}
                className="text-(--text-muted) hover:text-(--text-main) cursor-pointer"
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
                className="flex-1 px-3 py-1.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] text-(--text-main) focus:outline-none"
              />
              <button
                onClick={handleCreateSnapshot}
                disabled={!newSnapshotName.trim()}
                className="px-3 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) disabled:opacity-50 text-white text-[12px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Save State</span>
              </button>
            </div>

            {/* List of Snapshots */}
            <div className="flex-1 overflow-y-auto space-y-2 max-h-60 pt-2">
              {bottleSnapshots.length === 0 ? (
                <p className="text-[12px] text-(--text-muted) italic text-center py-6">
                  No snapshots created yet.
                </p>
              ) : (
                bottleSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-lg border border-(--border-color) bg-(--bg-elevated) flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-[12px] text-(--text-main)">{snap.name}</p>
                      <p className="text-[10px] font-mono text-(--text-muted)">
                        {(snap.size_bytes / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        className="px-2.5 py-1 rounded bg-(--bg-surface) hover:bg-(--border-color) border border-(--border-color) text-[11px] font-medium text-(--text-main) cursor-pointer"
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
          <div className="w-full max-w-md rounded-xl bg-(--bg-surface) border border-(--border-color) p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-(--text-main)">
                Duplicate {bottle.name}
              </h3>
              <button
                onClick={() => setShowCloneModal(false)}
                className="text-(--text-muted) hover:text-(--text-main) cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-(--text-muted) block">
                New Bottle Name
              </label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] text-(--text-main) focus:outline-none focus:border-(--accent-primary)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCloneModal(false)}
                className="px-3 py-1.5 rounded-lg border border-(--border-color) text-[12px] font-medium text-(--text-secondary) hover:bg-(--bg-elevated) cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!cloneName.trim()}
                className="px-4 py-1.5 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[12px] font-medium cursor-pointer"
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bottle Logs Viewer */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[75vh] rounded-2xl bg-(--bg-surface) border border-(--border-color) shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="p-4 border-b border-(--border-color) flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-(--accent-primary)" />
                <div>
                  <h3 className="text-[14px] font-semibold text-(--text-main)">
                    Application Logs — {bottle.name}
                  </h3>
                  <p className="text-[11px] text-(--text-muted) font-mono">
                    Captured standard output and error streams
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openLogsDirectory()}
                  className="px-2.5 py-1.5 rounded-lg border border-(--border-color) hover:bg-(--bg-elevated) text-(--text-secondary) text-[11px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Folder</span>
                </button>
                <button
                  onClick={handleOpenLogs}
                  className="p-1.5 rounded-lg border border-(--border-color) hover:bg-(--bg-elevated) text-(--text-secondary) transition-colors cursor-pointer"
                  title="Refresh logs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-1.5 text-(--text-muted) hover:text-(--text-main) cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Split View */}
            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 border-r border-(--border-color) bg-(--bg-surface) overflow-y-auto p-2 space-y-1">
                <p className="text-[10px] font-mono uppercase text-(--text-muted) px-2 py-1">
                  Log Files ({bottleLogs.length})
                </p>
                {bottleLogs.length === 0 ? (
                  <p className="text-[11px] text-(--text-muted) font-mono p-2">
                    No logs recorded yet.
                  </p>
                ) : (
                  bottleLogs.map((log) => {
                    const isSelected = selectedLogPath === log.path;
                    return (
                      <button
                        key={log.path}
                        onClick={() => handleSelectLog(log.path)}
                        className={`w-full text-left p-2 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-(--accent-primary)/15 border border-(--accent-primary)/40 text-(--text-main)"
                            : "hover:bg-(--bg-elevated) text-(--text-secondary)"
                        }`}
                      >
                        <p className="truncate font-semibold">{log.filename}</p>
                        <p className="text-[10px] text-(--text-muted) mt-0.5">
                          {(log.size_bytes / 1024).toFixed(1)} KB
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex-1 bg-black/40 overflow-auto p-4 font-mono text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap select-text">
                {selectedLogContent || "Select a log file to view its content."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Bottle */}
      {confirmDeleteBottle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-(--bg-surface) border border-(--border-color) p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-(--text-main)">Delete Bottle?</h3>
              <p className="text-[12px] text-(--text-muted) mt-1.5 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-(--text-main)">"{bottle.name}"</span>? All installed programs and prefix files will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setConfirmDeleteBottle(false)}
                className="px-4 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-(--text-main) text-[12px] font-semibold hover:bg-(--bg-surface) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setConfirmDeleteBottle(false);
                  try {
                    await deleteBottle(bottle.id);
                    onRefreshState();
                    onBottleDeleted();
                  } catch (e) {
                    setError((e as FusionErrorPayload).message || "Delete failed.");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Snapshot */}
      {confirmDeleteSnapshotId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-(--bg-surface) border border-(--border-color) p-6 shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-(--text-main)">Delete Snapshot?</h3>
              <p className="text-[12px] text-(--text-muted) mt-1.5 leading-relaxed">
                This will permanently delete the snapshot archive from your disk.
              </p>
            </div>
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => setConfirmDeleteSnapshotId(null)}
                className="px-4 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-(--text-main) text-[12px] font-semibold hover:bg-(--bg-surface) transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = confirmDeleteSnapshotId;
                  setConfirmDeleteSnapshotId(null);
                  try {
                    await deleteSnapshot(id);
                    onRefreshState();
                    setNotice("Snapshot deleted.");
                  } catch (e) {
                    setError((e as FusionErrorPayload).message || "Failed to delete snapshot.");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

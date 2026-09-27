import { useState } from "react";
import {
  FlaskConical,
  Plus,
  Trash2,
  Copy,
  Wrench,
  Camera,
  Cpu,
  X,
  RotateCcw,
  Zap,
  Activity,
  Terminal,
  Power,
  PackagePlus,
  Monitor,
  CheckCircle,
} from "lucide-react";
import {
  createBottle,
  cloneBottle,
  deleteBottle,
  repairBottle,
  updateBottle,
  killBottleProcesses,
  launchWineTool,
  installBottleVerb,
  createSnapshot,
  restoreSnapshot,
  Bottle,
  BottleTemplate,
  Snapshot,
  FusionErrorPayload,
} from "../services/tauri";

interface BottlesViewProps {
  bottles: Bottle[];
  templates: BottleTemplate[];
  snapshots: Snapshot[];
  onRefreshState: () => void;
}

export const BottlesView: React.FC<BottlesViewProps> = ({
  bottles,
  templates,
  snapshots,
  onRefreshState,
}) => {
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(
    bottles.length > 0 ? bottles[0] : null
  );
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newBottleName, setNewBottleName] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("gaming");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [snapshotName, setSnapshotName] = useState<string>("");
  const [customVerb, setCustomVerb] = useState<string>("");
  const [installingVerb, setInstallingVerb] = useState<boolean>(false);

  const handleCreate = async () => {
    if (!newBottleName.trim()) return;
    setError(null);
    try {
      const b = await createBottle(newBottleName.trim(), selectedTemplate);
      setShowCreateModal(false);
      setNewBottleName("");
      onRefreshState();
      setNotice(`Created bottle environment "${b.name}".`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to create bottle.");
    }
  };

  const handleDelete = async (bottleId: string) => {
    if (!confirm("Are you sure you want to delete this bottle environment and all its contents?"))
      return;
    try {
      await deleteBottle(bottleId);
      setSelectedBottle(null);
      onRefreshState();
      setNotice("Bottle deleted.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to delete bottle.");
    }
  };

  const handleClone = async (bottle: Bottle) => {
    try {
      const cloned = await cloneBottle(bottle.id, `${bottle.name} (Copy)`);
      onRefreshState();
      setSelectedBottle(cloned);
      setNotice(`Cloned bottle as "${cloned.name}".`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to clone bottle.");
    }
  };

  const handleRepair = async (bottleId: string) => {
    try {
      await repairBottle(bottleId);
      setNotice("Bottle prefix repaired and updated successfully.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Repair failed.");
    }
  };

  const handleKillProcesses = async (bottleId: string) => {
    try {
      await killBottleProcesses(bottleId);
      setNotice("All running processes and wineserver daemon killed for this bottle.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to kill processes.");
    }
  };

  const handleGraphicsChange = async (bottleId: string, graphics: string) => {
    try {
      const dxvk = graphics === "dxvk" || graphics === "d3dmetal" || graphics === "dxmt";
      await updateBottle(bottleId, { graphics, dxvk_enabled: dxvk });
      onRefreshState();
      setNotice(`Graphics updated to ${graphics.toUpperCase()}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update graphics.");
    }
  };

  const handleToggleMsync = async (bottle: Bottle) => {
    try {
      await updateBottle(bottle.id, { msync_enabled: !bottle.msync_enabled });
      onRefreshState();
      setNotice(`MSync (Mach fast synchronization) ${!bottle.msync_enabled ? "enabled" : "disabled"}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update MSync.");
    }
  };

  const handleToggleHud = async (bottle: Bottle) => {
    try {
      await updateBottle(bottle.id, { performance_hud: !bottle.performance_hud });
      onRefreshState();
      setNotice(`Performance HUD overlay ${!bottle.performance_hud ? "enabled" : "disabled"}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update HUD.");
    }
  };

  const handleToggleRetina = async (bottle: Bottle) => {
    try {
      await updateBottle(bottle.id, { retina_mode: !bottle.retina_mode });
      onRefreshState();
      setNotice(`Retina High-DPI mode ${!bottle.retina_mode ? "enabled" : "disabled"}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update Retina mode.");
    }
  };

  const handleLaunchWineTool = async (bottleId: string, tool: string) => {
    try {
      await launchWineTool(bottleId, tool);
      setNotice(`Launched ${tool} inside bottle.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || `Failed to launch ${tool}.`);
    }
  };

  const handleInstallVerb = async (bottleId: string, verb: string) => {
    if (!verb.trim()) return;
    setInstallingVerb(true);
    try {
      await installBottleVerb(bottleId, verb.trim());
      setCustomVerb("");
      onRefreshState();
      setNotice(`Installation queued for ${verb}. See Jobs indicator.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || `Failed to install ${verb}.`);
    } finally {
      setInstallingVerb(false);
    }
  };

  const handleCreateSnapshot = async (bottleId: string) => {
    if (!snapshotName.trim()) return;
    try {
      await createSnapshot(bottleId, snapshotName.trim());
      setSnapshotName("");
      onRefreshState();
      setNotice("Snapshot created successfully.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to create snapshot.");
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!confirm("Restoring a snapshot will overwrite current bottle files. Continue?")) return;
    try {
      await restoreSnapshot(snapshotId);
      setNotice("Snapshot restored successfully.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to restore snapshot.");
    }
  };

  const bottleSnapshots = selectedBottle
    ? snapshots.filter((s) => s.bottle_id === selectedBottle.id)
    : [];

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* Bottle Rail List */}
      <div className="w-full md:w-[280px] shrink-0 border-r border-graphite-600/70 bg-graphite-900/60 p-4 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
              Bottle Environments
            </h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1 px-2"
            >
              <Plus className="w-3.5 h-3.5" /> NEW
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[70vh]">
            {bottles.map((b) => {
              const isSel = selectedBottle?.id === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBottle(b)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSel
                      ? "bg-graphite-800 border-accent-500/70 shadow-sm"
                      : "bg-graphite-850/50 border-graphite-700/60 hover:bg-graphite-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-graphite-100 truncate">{b.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-graphite-950 text-accent-400">
                      {b.prefix_type}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-graphite-400 mt-1">
                    {b.windows_version} · {b.graphics}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Bottle Inspector & Configuration */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {notice && (
          <div className="rounded-xl border border-ok/40 bg-ok/10 p-3 text-[12px] text-ok font-mono flex items-center justify-between">
            <span>✓ {notice}</span>
            <button onClick={() => setNotice(null)} className="text-ok hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-err/40 bg-err/10 p-3 text-[12px] text-err font-mono">
            ⚠ {error}
          </div>
        )}

        {selectedBottle ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-ok/10 text-ok border border-ok/30 flex items-center justify-center font-mono font-bold text-[14px]">
                    <FlaskConical className="w-4 h-4" />
                  </span>
                  <div>
                    <h1 className="text-[20px] font-bold text-graphite-100">{selectedBottle.name}</h1>
                    <p className="text-[11px] font-mono text-graphite-400">
                      Template: {selectedBottle.prefix_type} · Path: {selectedBottle.path}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleKillProcesses(selectedBottle.id)}
                  title="Kill all wine processes and wineserver daemon"
                  className="px-3 py-1.5 rounded-lg bg-err/10 hover:bg-err/20 text-err font-mono text-[11px] flex items-center gap-1.5 border border-err/30"
                >
                  <Power className="w-3.5 h-3.5" /> Stop Wineserver
                </button>
                <button
                  onClick={() => handleRepair(selectedBottle.id)}
                  className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-mono text-[11px] flex items-center gap-1.5 border border-graphite-700"
                >
                  <Wrench className="w-3.5 h-3.5 text-warn" /> Repair Prefix
                </button>
                <button
                  onClick={() => handleClone(selectedBottle)}
                  className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-mono text-[11px] flex items-center gap-1.5 border border-graphite-700"
                >
                  <Copy className="w-3.5 h-3.5 text-accent-400" /> Clone
                </button>
                <button
                  onClick={() => handleDelete(selectedBottle.id)}
                  className="px-3 py-1.5 rounded-lg bg-err/10 hover:bg-err/20 text-err font-mono text-[11px] flex items-center gap-1.5 border border-err/30"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            {/* Gaming & Synchronization Tuning (CrossOver MSync & HUD parity) */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-warn" /> Gaming & Performance Tuning
                  </h2>
                  <p className="text-[12px] text-graphite-300 mt-1">
                    Kernel-level synchronization & performance diagnostics for Apple Silicon.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* MSync Card */}
                <div
                  onClick={() => handleToggleMsync(selectedBottle)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedBottle.msync_enabled
                      ? "bg-ok/10 border-ok/50 text-graphite-100"
                      : "bg-graphite-950 border-graphite-700 text-graphite-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold flex items-center gap-1.5">
                      <Zap className={`w-3.5 h-3.5 ${selectedBottle.msync_enabled ? "text-ok" : "text-graphite-500"}`} />
                      MSync Fast Sync
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${selectedBottle.msync_enabled ? "bg-ok/20 text-ok" : "bg-graphite-800 text-graphite-500"}`}>
                      {selectedBottle.msync_enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-graphite-400 mt-2 font-mono">
                    Mach semaphore synchronization. Eliminates wineserver bottleneck for high-FPS games.
                  </p>
                </div>

                {/* Performance HUD Card */}
                <div
                  onClick={() => handleToggleHud(selectedBottle)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedBottle.performance_hud
                      ? "bg-accent-500/10 border-accent-500/50 text-graphite-100"
                      : "bg-graphite-950 border-graphite-700 text-graphite-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold flex items-center gap-1.5">
                      <Activity className={`w-3.5 h-3.5 ${selectedBottle.performance_hud ? "text-accent-400" : "text-graphite-500"}`} />
                      Performance HUD
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${selectedBottle.performance_hud ? "bg-accent-500/20 text-accent-300" : "bg-graphite-800 text-graphite-500"}`}>
                      {selectedBottle.performance_hud ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-graphite-400 mt-2 font-mono">
                    Real-time in-game HUD showing Metal/Vulkan FPS, frame timings, and GPU memory load.
                  </p>
                </div>

                {/* Retina High-DPI Card */}
                <div
                  onClick={() => handleToggleRetina(selectedBottle)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedBottle.retina_mode
                      ? "bg-accent-500/10 border-accent-500/50 text-graphite-100"
                      : "bg-graphite-950 border-graphite-700 text-graphite-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-bold flex items-center gap-1.5">
                      <Monitor className={`w-3.5 h-3.5 ${selectedBottle.retina_mode ? "text-accent-400" : "text-graphite-500"}`} />
                      Retina Mode
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${selectedBottle.retina_mode ? "bg-accent-500/20 text-accent-300" : "bg-graphite-800 text-graphite-500"}`}>
                      {selectedBottle.retina_mode ? "ON" : "OFF"}
                    </span>
                  </div>
                  <p className="text-[11px] text-graphite-400 mt-2 font-mono">
                    High-DPI resolution scaling (192 DPI) for sharp fonts and high-resolution displays.
                  </p>
                </div>
              </div>
            </div>

            {/* Graphics Backend Configuration */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-3">
              <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-accent-400" /> Graphics Translator
              </h2>
              <p className="text-[12px] text-graphite-300">
                DirectX-to-Metal translation backend. Automatic picks D3DMetal/DXVK based on hardware.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {["automatic", "d3dmetal", "dxvk", "dxmt", "wined3d"].map((g) => {
                  const active = (selectedBottle.graphics || "automatic") === g;
                  return (
                    <button
                      key={g}
                      onClick={() => handleGraphicsChange(selectedBottle.id, g)}
                      className={`p-3 rounded-lg border font-mono text-left transition-all ${
                        active
                          ? "bg-accent-500/10 border-accent-500 text-accent-300 shadow-sm"
                          : "bg-graphite-950 border-graphite-700 text-graphite-300 hover:bg-graphite-800"
                      }`}
                    >
                      <p className="text-[12px] font-bold uppercase">{g}</p>
                      <p className="text-[10px] text-graphite-400 mt-1">
                        {g === "automatic"
                          ? "Auto (D3DMetal/DXVK)"
                          : g === "d3dmetal"
                          ? "Apple GPTK Metal"
                          : g === "dxvk"
                          ? "Vulkan DirectX 9-11"
                          : g === "dxmt"
                          ? "Direct Metal DX11"
                          : "Wine Native OpenGL"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Wine Configuration Tools (Control Panel / Winecfg / Regedit / Task Manager) */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-3">
              <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-accent-400" /> Wine Configuration Tools
              </h2>
              <p className="text-[12px] text-graphite-300">
                Launch Windows administration utilities directly in this bottle environment.
              </p>

              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                {[
                  { id: "winecfg", label: "Wine Configuration", desc: "Drives, audio, display, version" },
                  { id: "regedit", label: "Registry Editor", desc: "Registry keys & DLL overrides" },
                  { id: "taskmgr", label: "Task Manager", desc: "Manage running Windows processes" },
                  { id: "control", label: "Control Panel", desc: "Add/remove software & settings" },
                  { id: "cmd", label: "Command Prompt", desc: "Interactive Windows CMD shell" },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleLaunchWineTool(selectedBottle.id, tool.id)}
                    className="px-3 py-2 rounded-lg bg-graphite-950 hover:bg-graphite-800 border border-graphite-700 text-graphite-200 flex flex-col text-left transition-all"
                  >
                    <span className="font-bold text-accent-300">{tool.label}</span>
                    <span className="text-[10px] text-graphite-400">{tool.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dependencies & Winetricks Engine */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-ok" /> Bottle Dependencies & Runtime Redists
                  </h2>
                  <p className="text-[12px] text-graphite-300 mt-1">
                    Install Visual C++ runtimes, DirectX runtimes, and .NET frameworks into this bottle.
                  </p>
                </div>
              </div>

              {/* Installed dependencies badges */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-graphite-400 block">Installed in this bottle:</span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {selectedBottle.dependencies.length === 0 ? (
                    <span className="text-graphite-500 italic text-[11px]">No extra dependencies recorded.</span>
                  ) : (
                    selectedBottle.dependencies.map((dep) => (
                      <span
                        key={dep}
                        className="px-2 py-0.5 rounded bg-graphite-950 border border-ok/40 text-ok flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> {dep}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Quick install popular verbs */}
              <div className="space-y-2 pt-2 border-t border-graphite-800">
                <span className="text-[11px] font-mono text-graphite-400 block">Quick Install Common Game Dependencies:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { verb: "vcrun2022", label: "Visual C++ 2015-2022" },
                    { verb: "vcrun2019", label: "Visual C++ 2019" },
                    { verb: "d3dcompiler_47", label: "D3DCompiler 47 (DirectX)" },
                    { verb: "dxvk", label: "DXVK Runtime" },
                    { verb: "dotnet48", label: ".NET Framework 4.8" },
                    { verb: "corefonts", label: "Microsoft Core Fonts" },
                  ].map((item) => (
                    <button
                      key={item.verb}
                      disabled={installingVerb || selectedBottle.dependencies.includes(item.verb)}
                      onClick={() => handleInstallVerb(selectedBottle.id, item.verb)}
                      className={`px-2.5 py-1.5 rounded border font-mono text-[11px] transition-all ${
                        selectedBottle.dependencies.includes(item.verb)
                          ? "bg-graphite-950 border-graphite-800 text-graphite-600 cursor-not-allowed"
                          : "bg-graphite-850 hover:bg-graphite-800 border-graphite-700 text-graphite-200"
                      }`}
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Winetricks verb input */}
              <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                <input
                  type="text"
                  placeholder="Custom verb (e.g. xna40, quartz, mfc140)"
                  value={customVerb}
                  onChange={(e) => setCustomVerb(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-graphite-850 border border-graphite-700 text-graphite-100 placeholder:text-graphite-500 flex-1 max-w-sm"
                />
                <button
                  disabled={installingVerb || !customVerb.trim()}
                  onClick={() => handleInstallVerb(selectedBottle.id, customVerb)}
                  className="px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-40 text-white font-bold"
                >
                  {installingVerb ? "Installing..." : "Install Custom Verb"}
                </button>
              </div>
            </div>

            {/* Snapshots & Backups */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-ok" /> Bottle Snapshots (PRD §41)
                </h2>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Snapshot Name"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    className="px-2.5 py-1 rounded-md bg-graphite-850 border border-graphite-700 text-[11px] font-mono text-graphite-100"
                  />
                  <button
                    onClick={() => handleCreateSnapshot(selectedBottle.id)}
                    className="px-3 py-1 rounded bg-ok hover:bg-ok/90 text-black text-[11px] font-mono font-bold"
                  >
                    + Create Snapshot
                  </button>
                </div>
              </div>

              {bottleSnapshots.length === 0 ? (
                <p className="text-[12px] text-graphite-400 italic">No snapshots saved for this bottle.</p>
              ) : (
                <div className="space-y-2">
                  {bottleSnapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 flex items-center justify-between font-mono text-[12px]"
                    >
                      <div>
                        <span className="font-bold text-graphite-100">{snap.name}</span>
                        <span className="text-graphite-400 ml-2">
                          ({(snap.size_bytes / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                      </div>
                      <button
                        onClick={() => handleRestoreSnapshot(snap.id)}
                        className="px-2.5 py-1 rounded bg-graphite-800 hover:bg-graphite-700 text-accent-400 text-[10px] font-bold flex items-center gap-1 border border-graphite-600"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-graphite-400 font-mono text-[13px]">
            Select a bottle environment from the rail or create a new one.
          </div>
        )}
      </div>

      {/* Create Bottle Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-graphite-600 bg-graphite-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold text-graphite-100">Create Bottle Environment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-graphite-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-[12px]">
              <div>
                <label className="text-graphite-400 block mb-1">Bottle Name</label>
                <input
                  type="text"
                  placeholder="e.g. Gaming Bottle"
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 text-graphite-100 focus:outline-none focus:border-accent-500"
                />
              </div>

              <div>
                <label className="text-graphite-400 block mb-1">Template Preset (PRD §28)</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 text-graphite-100 capitalize"
                >
                  {templates.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label} ({t.windows_version} · {t.graphics})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-graphite-800 text-graphite-300 font-mono text-[12px]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-bold"
              >
                Create Bottle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
} from "lucide-react";
import {
  createBottle,
  cloneBottle,
  deleteBottle,
  repairBottle,
  updateBottle,
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

  const handleCreate = async () => {
    if (!newBottleName.trim()) return;
    setError(null);
    try {
      const b = await createBottle(newBottleName.trim(), selectedTemplate);
      setShowCreateModal(false);
      setNewBottleName("");
      onRefreshState();
      setSelectedBottle;
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

  const handleGraphicsChange = async (bottleId: string, graphics: string) => {
    try {
      const dxvk = graphics === "dxvk" || graphics === "d3dmetal";
      await updateBottle(bottleId, { graphics, dxvk_enabled: dxvk });
      onRefreshState();
      setNotice(`Graphics updated to ${graphics.toUpperCase()}.`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to update graphics.");
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

              <div className="flex items-center gap-2">
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

            {/* Graphics Backend Configuration */}
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-3">
              <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-accent-400" /> Graphics Manager
              </h2>
              <p className="text-[12px] text-graphite-300">
                Select graphics API backend. Automatic resolves optimal Metal/Vulkan translator for Apple Silicon.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {["automatic", "d3dmetal", "dxvk", "wined3d"].map((g) => {
                  const active = (selectedBottle.graphics || "automatic") === g;
                  return (
                    <button
                      key={g}
                      onClick={() => handleGraphicsChange(selectedBottle.id, g)}
                      className={`p-3 rounded-lg border font-mono text-left transition-all ${
                        active
                          ? "bg-accent-500/10 border-accent-500 text-accent-300"
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
                          : "Wine Native OpenGL"}
                      </p>
                    </button>
                  );
                })}
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

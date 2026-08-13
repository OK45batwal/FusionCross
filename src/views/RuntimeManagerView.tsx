import { useState } from "react";
import {
  Boxes,
  RefreshCw,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  importRuntime,
  probeRuntime,
  removeRuntime,
  Runtime,
  FusionErrorPayload,
} from "../services/tauri";

interface RuntimeManagerViewProps {
  runtimes: Runtime[];
  onRefreshState: () => void;
}

export const RuntimeManagerView: React.FC<RuntimeManagerViewProps> = ({
  runtimes,
  onRefreshState,
}) => {
  const [probeStatuses, setProbeStatuses] = useState<Record<string, string>>({});
  const [probing, setProbing] = useState<Record<string, boolean>>({});
  const [importName, setImportName] = useState<string>("");
  const [importPath, setImportPath] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleProbe = async (name: string) => {
    setProbing((prev: Record<string, boolean>) => ({ ...prev, [name]: true }));
    try {
      const res = await probeRuntime(name);
      setProbeStatuses((prev: Record<string, string>) => ({ ...prev, [name]: res.version }));
    } catch (e) {
      setProbeStatuses((prev: Record<string, string>) => ({
        ...prev,
        [name]: (e as FusionErrorPayload).message || "Not found",
      }));
    } finally {
      setProbing((prev: Record<string, boolean>) => ({ ...prev, [name]: false }));
    }
  };

  const handleImport = async () => {
    if (!importName.trim() || !importPath.trim()) return;
    setError(null);
    try {
      const rt = await importRuntime(importName.trim(), importPath.trim());
      setImportName("");
      setImportPath("");
      onRefreshState();
      setNotice(`Imported runtime "${rt.name}" (${rt.version}).`);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Runtime archive import failed.");
    }
  };

  const handleRemove = async (runtimeId: string) => {
    if (!confirm("Remove this runtime engine?")) return;
    try {
      await removeRuntime(runtimeId);
      onRefreshState();
      setNotice("Runtime removed.");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to remove runtime.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-graphite-600/70">
        <div>
          <h1 className="text-[20px] font-bold text-graphite-100 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-accent-400" /> Runtime Engine Manager
          </h1>
          <p className="text-[12px] text-graphite-400">
            PRD §32 · Wine Stable, Wine Staging, Wine-GE & Proton-GE runtime management
          </p>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-ok/40 bg-ok/10 p-3 text-[12px] text-ok font-mono">
          ✓ {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-err/40 bg-err/10 p-3 text-[12px] text-err font-mono">
          ⚠ {error}
        </div>
      )}

      {/* Available Engine Probing */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
          System Runtime Probing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["Wine Stable", "Wine-GE", "Proton-GE"].map((engine) => {
            const status = probeStatuses[engine];
            const isProbing = probing[engine];
            return (
              <div
                key={engine}
                className="rounded-xl border border-graphite-600 bg-graphite-900 p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[14px] font-bold text-graphite-100">{engine}</span>
                    <button
                      onClick={() => handleProbe(engine)}
                      className="p-1 rounded text-graphite-400 hover:text-graphite-100"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-graphite-400 mt-1">
                    {engine === "Wine Stable"
                      ? "Official Wine binary"
                      : engine === "Wine-GE"
                      ? "GloriousEggroll gaming patches"
                      : "Steam Proton compatibility build"}
                  </p>
                </div>

                <div className="pt-3 border-t border-graphite-700/60 font-mono text-[12px]">
                  {status ? (
                    <p className={status.includes("not found") ? "text-warn" : "text-ok"}>
                      ● {status}
                    </p>
                  ) : (
                    <button
                      onClick={() => handleProbe(engine)}
                      className="text-accent-400 hover:underline text-[11px]"
                    >
                      Probe Status →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Installed Runtimes Table */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
        <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
          Managed Runtime Catalog ({runtimes.length})
        </h2>

        <div className="divide-y divide-graphite-700/60 rounded-lg border border-graphite-700/60 bg-graphite-950 overflow-hidden">
          {runtimes.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between font-mono text-[12px]">
              <div>
                <span className="font-bold text-graphite-100">{r.name}</span>
                <span className="text-graphite-400 ml-2">v{r.version || "9.0"}</span>
                <span className="text-[10px] ml-3 px-2 py-0.5 rounded bg-graphite-850 text-accent-400 border border-graphite-700">
                  {r.category}
                </span>
                {r.note && <p className="text-[11px] text-graphite-400 mt-1">{r.note}</p>}
              </div>

              <div className="flex items-center gap-3">
                <span className={r.downloaded ? "text-ok" : "text-warn"}>
                  {r.downloaded ? "● Installed" : "○ Available"}
                </span>

                {r.downloaded && r.path && (
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="p-1.5 rounded text-err hover:bg-err/10"
                    title="Remove runtime"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Import Custom Runtime Archive */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
        <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-2">
          <Upload className="w-4 h-4 text-accent-400" /> Import Custom Runtime Archive (PRD §55)
        </h2>
        <p className="text-[12px] text-graphite-300">
          Import a custom Wine build archive (<span className="font-mono text-graphite-200">.tar.xz</span> or <span className="font-mono text-graphite-200">.tar.gz</span>). FusionCross automatically verifies, unpacks, and registers it safely.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[12px]">
          <input
            type="text"
            placeholder="Runtime Name (e.g. Wine-GE-8.26)"
            value={importName}
            onChange={(e) => setImportName(e.target.value)}
            className="px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 text-graphite-100 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Archive Path (e.g. /path/to/wine.tar.xz)"
            value={importPath}
            onChange={(e) => setImportPath(e.target.value)}
            className="px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 text-graphite-100 focus:outline-none"
          />
        </div>

        <button
          onClick={handleImport}
          disabled={!importName.trim() || !importPath.trim()}
          className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white font-mono text-[12px] font-bold flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Import & Register Runtime
        </button>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import {
  Bottle,
  analyzeInstaller,
  InstallerAnalysis,
  extractInstallerIcon,
  runCommandInBottle,
  registerApplication,
  scanBottle,
  createBottle,
  FusionErrorPayload,
} from "../services/tauri";
import {
  Play,
  Plus,
  X,
  FileCode,
  ShieldCheck,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface DroppedFileModalProps {
  filePath: string;
  initialBottleId: string;
  bottles: Bottle[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSelectBottle: (bottleId: string) => void;
}

export function DroppedFileModal({
  filePath,
  initialBottleId,
  bottles,
  onClose,
  onRefresh,
  onSelectBottle,
}: DroppedFileModalProps) {
  const [selectedBottleId, setSelectedBottleId] = useState<string>(initialBottleId);
  const [analysis, setAnalysis] = useState<InstallerAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installerIcon, setInstallerIcon] = useState<string | null>(null);

  // New bottle inline creation
  const [creatingNewBottle, setCreatingNewBottle] = useState(false);
  const [newBottleName, setNewBottleName] = useState("");

  const fileName = filePath.split("/").pop() || filePath;
  const isExeOrMsi = /\.(exe|msi|bat|cmd)$/i.test(fileName);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async analysis reset on filePath change
    setAnalyzing(true);
    setInstallerIcon(null);

    analyzeInstaller(filePath)
      .then((res) => {
        if (active) {
          setAnalysis(res);
          setAnalyzing(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.warn("Analysis failed or not an installer:", err);
          setAnalyzing(false);
        }
      });

    extractInstallerIcon(filePath)
      .then((icon) => {
        if (active && icon) {
          setInstallerIcon(icon);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [filePath]);

  const targetBottle = bottles.find((b) => b.id === selectedBottleId) || bottles[0];

  const handleCreateAndSelectBottle = async () => {
    if (!newBottleName.trim()) return;
    try {
      const created = await createBottle(newBottleName.trim(), "gaming");
      await onRefresh();
      setSelectedBottleId(created.id);
      setCreatingNewBottle(false);
      setNewBottleName("");
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Failed to create bottle");
    }
  };

  const handleInstall = async () => {
    if (!selectedBottleId && bottles.length === 0) {
      setError("Please create or select a bottle first.");
      return;
    }
    const bottleId = selectedBottleId || bottles[0]?.id;
    setExecuting(true);
    setError(null);
    try {
      // 1. Automatically register the program into the Applications Library
      const appName = fileName.replace(/\.(exe|msi|bat|cmd)$/i, "");
      await registerApplication(bottleId, appName, filePath, "applications");
      await onRefresh();

      // 2. Execute installer inside bottle
      await runCommandInBottle(bottleId, filePath, []);
      setActionSuccess(`Launched ${fileName} in bottle "${targetBottle?.name || 'Default'}" & added to Applications!`);
      
      // 3. Scan bottle prefix after delay for any newly extracted binaries (e.g. Steam.exe)
      setTimeout(async () => {
        try {
          await scanBottle(bottleId);
          await onRefresh();
        } catch {
          // ignore scan error
        }
      }, 3500);

      await onRefresh();
      onSelectBottle(bottleId);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Failed to launch installer in bottle.");
      setExecuting(false);
    }
  };

  const handleRegisterApp = async () => {
    if (!selectedBottleId && bottles.length === 0) return;
    const bottleId = selectedBottleId || bottles[0]?.id;
    setExecuting(true);
    setError(null);
    try {
      const appName = fileName.replace(/\.(exe|msi)$/i, "");
      await registerApplication(bottleId, appName, filePath, "applications");
      setActionSuccess(`Added "${appName}" to bottle application launcher!`);
      await onRefresh();
      onSelectBottle(bottleId);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Failed to register application.");
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-110 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-(--bg-card) border border-(--border-color) rounded-2xl max-w-lg w-full p-6 shadow-2xl shadow-black/40 text-left animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-(--border-color)">
          <div className="flex items-center gap-3">
            {installerIcon ? (
              <img
                src={installerIcon}
                alt={fileName}
                className="w-10 h-10 rounded-xl object-contain bg-(--bg-subtle) p-1 border border-(--border-color) shadow-xs shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-(--accent)/10 border border-(--accent)/20 flex items-center justify-center text-(--accent) shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="text-[16px] font-semibold text-(--text-primary) tracking-tight">
                Inspect Dropped File
              </h3>
              <p className="text-[12px] text-(--text-secondary) font-mono truncate max-w-xs">
                {fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="text-(--text-tertiary) hover:text-(--text-primary) p-1 rounded-md hover:bg-(--bg-hover) transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Analysis Section */}
        <div className="py-4 space-y-3">
          <div className="bg-(--bg-subtle) border border-(--border-color) rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-(--text-secondary) flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-(--accent)" /> Architecture:
              </span>
              <span className="font-mono text-(--text-primary) font-medium">
                {analyzing ? (
                  <span className="flex items-center gap-1 text-(--text-tertiary)">
                    <Loader2 className="w-3 h-3 animate-spin" /> Analyzing PE headers...
                  </span>
                ) : analysis ? (
                  `${analysis.arch.toUpperCase()} ${analysis.is_windows_installer ? "(Installer Package)" : "(Executable)"}`
                ) : isExeOrMsi ? (
                  "Windows PE Executable"
                ) : (
                  "Binary File"
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-[12px]">
              <span className="text-(--text-secondary) flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Translation Layer:
              </span>
              <span className="text-(--text-primary) font-mono text-[11px]">
                {analysis && analysis.size_bytes > 0
                  ? `${(analysis.size_bytes / (1024 * 1024)).toFixed(1)} MB • DXVK / Metal DXMT`
                  : "Whisky-Wine 11.0 (Apple GPTK)"}
              </span>
            </div>

            <div className="text-[11px] font-mono text-(--text-tertiary) break-all pt-1 border-t border-(--border-color)/60">
              {filePath}
            </div>
          </div>

          {/* Bottle Selector */}
          <div>
            <label className="text-[11px] font-medium text-(--text-secondary) block mb-1.5">
              Target Wine Bottle
            </label>

            {!creatingNewBottle ? (
              <div className="flex items-center gap-2">
                <select
                  aria-label="Select Target Bottle"
                  value={selectedBottleId}
                  onChange={(e) => setSelectedBottleId(e.target.value)}
                  className="flex-1 bg-(--bg-subtle) border border-(--border-color) text-[13px] rounded-lg px-3 py-2 text-(--text-primary) focus:outline-none focus:border-(--accent)"
                >
                  {bottles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.windows_version} • {b.graphics})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setCreatingNewBottle(true)}
                  className="px-3 py-2 text-[12px] bg-(--bg-subtle) hover:bg-(--bg-hover) border border-(--border-color) text-(--text-primary) rounded-lg flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Bottle Name (e.g. Gaming Bottle)"
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  className="flex-1 bg-(--bg-subtle) border border-(--border-color) text-[13px] rounded-lg px-3 py-2 text-(--text-primary) focus:outline-none focus:border-(--accent)"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateAndSelectBottle}
                  className="px-3 py-2 text-[12px] bg-(--accent) hover:bg-(--accent-hover) text-white font-medium rounded-lg"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setCreatingNewBottle(false)}
                  className="px-2 py-2 text-[12px] text-(--text-tertiary) hover:text-(--text-primary)"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Feedback & Alerts */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[12px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[12px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-(--border-color)">
          <div className="text-[11px] text-(--text-tertiary) flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Sandboxed Bottle Execution
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-[12px] text-(--text-secondary) hover:text-(--text-primary) rounded-lg hover:bg-(--bg-hover) transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={executing || bottles.length === 0}
              onClick={handleRegisterApp}
              className="px-3 py-1.5 text-[12px] bg-(--bg-subtle) hover:bg-(--bg-hover) border border-(--border-color) text-(--text-primary) rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Add to application shelf without executing now"
            >
              <Plus className="w-3.5 h-3.5" /> Add to Shelf
            </button>

            <button
              type="button"
              disabled={executing || bottles.length === 0}
              onClick={handleInstall}
              className="px-4 py-1.5 text-[12px] font-medium bg-(--accent) hover:bg-(--accent-hover) text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
            >
              {executing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Install & Run
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

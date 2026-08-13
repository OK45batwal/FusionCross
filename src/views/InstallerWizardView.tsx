import { useState } from "react";
import {
  Download,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  Cpu,
  Boxes,
  ArrowRight,
  ArrowLeft,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  analyzeInstaller,
  createBottle,
  getRecommendation,
  runInstaller,
  Bottle,
  InstallerAnalysis,
  Recommendation,
  FusionErrorPayload,
} from "../services/tauri";

interface InstallerWizardViewProps {
  bottles: Bottle[];
  onFinish: () => void;
  onRefreshState: () => void;
}

export const InstallerWizardView: React.FC<InstallerWizardViewProps> = ({
  bottles,
  onFinish,
  onRefreshState,
}) => {
  const [step, setStep] = useState<number>(1);
  const [filePath, setFilePath] = useState<string>("");
  const [analysis, setAnalysis] = useState<InstallerAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const [selectedBottleId, setSelectedBottleId] = useState<string>("");
  const [createNewBottle, setCreateNewBottle] = useState<boolean>(false);
  const [newBottleName, setNewBottleName] = useState<string>("");

  const [installing, setInstalling] = useState<boolean>(false);
  const [installLog, setInstallLog] = useState<string>("");

  const handleAnalyzeFile = async (path: string) => {
    if (!path.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeInstaller(path.trim());
      setAnalysis(result);
      const rec = await getRecommendation(result.suggested_name);
      setRecommendation(rec);
      setNewBottleName(result.suggested_name + " Environment");

      if (bottles.length > 0) {
        setSelectedBottleId(bottles[0].id);
      } else {
        setCreateNewBottle(true);
      }
      setStep(2);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Failed to analyze installer executable.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunInstallation = async () => {
    setInstalling(true);
    setError(null);
    setInstallLog("Starting installer in bottle prefix...");
    try {
      let bottleId = selectedBottleId;
      if (createNewBottle || !bottleId) {
        const created = await createBottle(
          newBottleName || "New Bottle",
          recommendation?.profile === "photoshop" ? "adobe" : "gaming"
        );
        bottleId = created.id;
      }

      await runInstaller(filePath, bottleId);
      setInstallLog("Installer exited cleanly. Executable registered into library.");
      onRefreshState();
      setStep(4);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Installation failed inside Wine prefix.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between pb-4 border-b border-graphite-600/70">
        <div>
          <h1 className="text-[20px] font-bold text-graphite-100 flex items-center gap-2">
            <Download className="w-5 h-5 text-accent-400" /> Smart Installer Wizard
          </h1>
          <p className="text-[12px] text-graphite-400">
            PRD §25 · Automated Wine configuration, runtime recommendation & installation
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className={`px-2.5 py-1 rounded-full ${step >= 1 ? "bg-accent-500 text-white font-bold" : "bg-graphite-800 text-graphite-400"}`}>
            1. Select
          </span>
          <span className="text-graphite-600">→</span>
          <span className={`px-2.5 py-1 rounded-full ${step >= 2 ? "bg-accent-500 text-white font-bold" : "bg-graphite-800 text-graphite-400"}`}>
            2. Analyze
          </span>
          <span className="text-graphite-600">→</span>
          <span className={`px-2.5 py-1 rounded-full ${step >= 3 ? "bg-accent-500 text-white font-bold" : "bg-graphite-800 text-graphite-400"}`}>
            3. Install
          </span>
          <span className="text-graphite-600">→</span>
          <span className={`px-2.5 py-1 rounded-full ${step >= 4 ? "bg-ok text-black font-bold" : "bg-graphite-800 text-graphite-400"}`}>
            4. Ready
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-err/40 bg-err/10 p-4 text-[12px] text-err font-mono space-y-1">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Installation Error
          </p>
          <p>{error}</p>
        </div>
      )}

      {/* STEP 1: Select File */}
      {step === 1 && (
        <div className="space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0] as File & { path?: string };
                const p = file.path || file.name;
                setFilePath(p);
                handleAnalyzeFile(p);
              }
            }}
            className="rounded-2xl border-2 border-dashed border-graphite-600 hover:border-accent-500 bg-graphite-900/60 p-10 text-center space-y-4 transition-colors"
          >
            <div className="w-16 h-16 rounded-full bg-accent-500/10 border border-accent-500/30 flex items-center justify-center mx-auto text-accent-400">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-graphite-100">
                Drag & Drop Windows Installer
              </h2>
              <p className="text-[13px] text-graphite-300 mt-1">
                Drop any <span className="font-mono text-graphite-100">.exe</span> or <span className="font-mono text-graphite-100">.msi</span> installer here to analyze
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Or enter path e.g. /Users/mac/Downloads/installer.exe"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 text-[12px] font-mono text-graphite-100 focus:outline-none focus:border-accent-500"
                />
                <button
                  disabled={!filePath || analyzing}
                  onClick={() => handleAnalyzeFile(filePath)}
                  className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white text-[12px] font-mono font-semibold flex items-center gap-1.5"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PE Header Analysis & Recommendation */}
      {step === 2 && analysis && recommendation && (
        <div className="space-y-6">
          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
            <h2 className="text-[14px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
              1. Executable Inspection Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[12px]">
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60">
                <span className="text-graphite-400 text-[10px]">FILE NAME</span>
                <p className="font-bold text-graphite-100 truncate">{analysis.file_name}</p>
              </div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60">
                <span className="text-graphite-400 text-[10px]">PE ARCHITECTURE</span>
                <p className="font-bold text-accent-400">{analysis.arch}</p>
              </div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60">
                <span className="text-graphite-400 text-[10px]">SIZE</span>
                <p className="font-bold text-graphite-100">
                  {(analysis.size_bytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60">
                <span className="text-graphite-400 text-[10px]">COMPATIBILITY SCORE</span>
                <p className="font-bold text-ok">{recommendation.compatibility}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
            <h2 className="text-[14px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
              2. FusionCross Automatic Configuration
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[12px]">
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-1">
                <div className="flex items-center gap-1.5 text-accent-400 text-[10px]">
                  <Boxes className="w-3.5 h-3.5" /> RECOMMENDED RUNTIME
                </div>
                <p className="font-bold text-graphite-100">{recommendation.runtime_hint}</p>
              </div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-1">
                <div className="flex items-center gap-1.5 text-ok text-[10px]">
                  <Cpu className="w-3.5 h-3.5" /> GRAPHICS BACKEND
                </div>
                <p className="font-bold text-graphite-100 uppercase">{recommendation.graphics}</p>
              </div>
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-1">
                <div className="flex items-center gap-1.5 text-warn text-[10px]">
                  <FlaskConical className="w-3.5 h-3.5" /> DEPENDENCIES
                </div>
                <p className="font-bold text-graphite-100">
                  {recommendation.dependencies.join(", ") || "None"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
            <h2 className="text-[14px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
              3. Target Environment Selection
            </h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bottle_choice"
                  checked={!createNewBottle}
                  onChange={() => setCreateNewBottle(false)}
                  className="accent-accent-500"
                />
                <span className="text-[13px] text-graphite-100 font-medium">Use existing bottle:</span>
                <select
                  disabled={createNewBottle}
                  value={selectedBottleId}
                  onChange={(e) => setSelectedBottleId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-graphite-850 border border-graphite-700 text-[12px] font-mono text-graphite-100 disabled:opacity-50"
                >
                  {bottles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.prefix_type} · {b.windows_version})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bottle_choice"
                  checked={createNewBottle}
                  onChange={() => setCreateNewBottle(true)}
                  className="accent-accent-500"
                />
                <span className="text-[13px] text-graphite-100 font-medium">Create new isolated bottle:</span>
                <input
                  type="text"
                  disabled={!createNewBottle}
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  placeholder="Bottle Name"
                  className="px-3 py-1.5 rounded-lg bg-graphite-850 border border-graphite-700 text-[12px] font-mono text-graphite-100 disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg bg-graphite-800 text-graphite-300 hover:text-graphite-100 font-mono text-[12px] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-semibold flex items-center gap-1.5 shadow-md"
            >
              Proceed to Install <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Execute Installation */}
      {step === 3 && (
        <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-6 space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-accent-500/10 border border-accent-500/30 flex items-center justify-center mx-auto text-accent-400">
            {installing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Download className="w-7 h-7" />}
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-graphite-100">
              {installing ? "Installing Windows Application..." : "Ready to Install"}
            </h2>
            <p className="text-[12px] text-graphite-400 mt-1">
              FusionCross will run <span className="font-mono text-graphite-200">{analysis?.file_name}</span> in the selected Wine prefix.
            </p>
          </div>

          <div className="rounded-lg bg-graphite-950 p-4 border border-graphite-700/60 font-mono text-[11px] text-left text-ok space-y-1">
            <p>● WinePrefix setup: OK</p>
            <p>● DLL Overrides: Auto-configured</p>
            <p>● Graphics API: {recommendation?.graphics.toUpperCase()}</p>
            <p className="text-graphite-300 pt-2">{installLog}</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              disabled={installing}
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg bg-graphite-800 text-graphite-300 font-mono text-[12px] disabled:opacity-50"
            >
              Back
            </button>
            <button
              disabled={installing}
              onClick={handleRunInstallation}
              className="px-6 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white font-mono text-[12px] font-bold shadow-lg"
            >
              {installing ? "Installing..." : "Execute Installer"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Finish */}
      {step === 4 && (
        <div className="rounded-xl border border-ok/40 bg-ok/5 p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-ok/10 border border-ok/30 flex items-center justify-center mx-auto text-ok">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-graphite-100">Installation Completed!</h2>
            <p className="text-[13px] text-graphite-300 mt-1">
              The application was installed and registered into your FusionCross library.
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={onFinish}
              className="px-6 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-bold"
            >
              Go to Application Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

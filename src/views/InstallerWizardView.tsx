import React, { useState } from "react";
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
  Sparkles,
} from "lucide-react";
import {
  analyzeInstaller,
  createBottle,
  getRecommendation,
  runInstaller,
  installCatalogGame,
  listJobs,
  Bottle,
  InstallerAnalysis,
  Recommendation,
  FusionErrorPayload,
} from "../services/tauri";

interface InstallerWizardViewProps {
  bottles: Bottle[];
  onFinish: () => void;
  onRefreshState: () => void | Promise<void>;
}

const POPULAR_PRESETS = [
  { id: "steam", name: "Steam", category: "Store & Launcher", direct: true },
  { id: "battlenet", name: "Battle.net", category: "Store & Launcher", direct: true },
  { id: "epicgames", name: "Epic Games", category: "Store & Launcher", direct: true },
  { id: "gog", name: "GOG GALAXY", category: "Store & Launcher", direct: true },
  { id: "eaapp", name: "EA App", category: "Store & Launcher", direct: true },
  { id: "cyberpunk", name: "Cyberpunk 2077", category: "Action RPG", direct: false },
  { id: "eldenring", name: "Elden Ring", category: "Action RPG", direct: false },
  { id: "baldursgate3", name: "Baldur's Gate 3", category: "Action RPG", direct: false },
  { id: "skyrim", name: "Skyrim SE", category: "RPG", direct: false },
  { id: "raji", name: "Raji: An Ancient Epic", category: "Mythic Action", direct: false },
];

export const InstallerWizardView: React.FC<InstallerWizardViewProps> = ({
  bottles,
  onFinish,
  onRefreshState,
}) => {
  const [step, setStep] = useState<number>(1);
  const [filePath, setFilePath] = useState<string>("");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<InstallerAnalysis | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const [selectedBottleId, setSelectedBottleId] = useState<string>("");
  const [createNewBottle, setCreateNewBottle] = useState<boolean>(false);
  const [newBottleName, setNewBottleName] = useState<string>("");

  const [installing, setInstalling] = useState<boolean>(false);
  const [installLog, setInstallLog] = useState<string>("");

  const handleSelectPreset = async (preset: { id: string; name: string; direct: boolean }) => {
    setSelectedPresetId(preset.id);
    setAnalyzing(true);
    setError(null);
    try {
      const rec = await getRecommendation(preset.name);
      setRecommendation(rec);
      setAnalysis({
        path: preset.name,
        file_name: `${preset.name} Installer`,
        extension: "exe",
        size_bytes: 120 * 1024 * 1024,
        arch: "x86_64",
        suggested_name: preset.name,
        is_windows_installer: true,
      });
      setNewBottleName(`${preset.name} Environment`);

      if (bottles.length > 0) {
        setSelectedBottleId(bottles[0].id);
      } else {
        setCreateNewBottle(true);
      }
      setStep(2);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Failed to load game profile.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeFile = async (path: string) => {
    if (!path.trim()) return;
    setSelectedPresetId(null);
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
    setInstallLog("Initializing installer job inside Wine prefix...");

    try {
      let bottleId = selectedBottleId;
      if (createNewBottle || !bottleId) {
        const created = await createBottle(
          newBottleName || "New Bottle",
          recommendation?.profile === "photoshop" ? "productivity" : "gaming"
        );
        bottleId = created.id;
      }

      // If preset with direct installer URL, trigger automated download & install
      if (selectedPresetId && ["steam", "battlenet", "epicgames", "gog", "eaapp"].includes(selectedPresetId)) {
        setInstallLog(`Downloading & installing ${recommendation?.profile || 'launcher'}...`);
        const jobId = await installCatalogGame(selectedPresetId, bottleId);
        
        let outcome = "";
        let failed = "";
        for (let attempt = 0; attempt < 200; attempt++) {
          await new Promise((r) => setTimeout(r, 1500));
          const jobs = await listJobs();
          const job = jobs.find((j) => j.id === jobId);
          if (!job) continue;
          if (job.status === "Done") {
            outcome = job.message || "Installation finished successfully!";
            break;
          }
          if (job.status === "Failed") {
            failed = job.message || "Installation failed in bottle prefix.";
            break;
          }
          setInstallLog(job.message || "Downloading & configuring Wine prefix...");
        }

        if (failed) {
          setError(failed);
          setStep(3);
          return;
        }

        await onRefreshState();
        setInstallLog(outcome || "Application installed into library!");
        setStep(4);
        return;
      }

      // Standard local file installer
      const jobId = await runInstaller(filePath, bottleId);
      setInstallLog("Installer running in Wine prefix. Polling for completion...");

      let outcome = "";
      let failed = "";
      for (let attempt = 0; attempt < 200; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const jobs = await listJobs();
        const job = jobs.find((j) => j.id === jobId);
        if (!job) continue;
        if (job.status === "Done") {
          outcome = job.message || "Installer exited; application registered.";
          break;
        }
        if (job.status === "Failed") {
          failed = job.message || "Installation failed inside Wine prefix.";
          break;
        }
        setInstallLog(job.message || "Installing...");
      }

      if (failed) {
        setError(failed);
        setStep(3);
        return;
      }
      if (!outcome) {
        setError("Installation timed out while polling the background job.");
        setStep(3);
        return;
      }

      await onRefreshState();
      setInstallLog(outcome);
      setStep(4);
    } catch (e) {
      const err = e as FusionErrorPayload;
      setError(err.message || "Installation failed inside Wine prefix.");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6 text-[var(--text-main)]">
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-main)] flex items-center gap-2">
            <Download className="w-5 h-5 text-[var(--accent-primary)]" />
            Smart Installer Wizard
          </h1>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Automated Wine configuration, translation engine tuning & one-click setup
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span
            className={`px-2.5 py-1 rounded-full ${
              step >= 1 ? "bg-[var(--accent-primary)] text-white font-bold" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            1. Select
          </span>
          <span className="text-[var(--text-muted)]">→</span>
          <span
            className={`px-2.5 py-1 rounded-full ${
              step >= 2 ? "bg-[var(--accent-primary)] text-white font-bold" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            2. Recipe
          </span>
          <span className="text-[var(--text-muted)]">→</span>
          <span
            className={`px-2.5 py-1 rounded-full ${
              step >= 3 ? "bg-[var(--accent-primary)] text-white font-bold" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            3. Install
          </span>
          <span className="text-[var(--text-muted)]">→</span>
          <span
            className={`px-2.5 py-1 rounded-full ${
              step >= 4 ? "bg-[var(--color-ok)] text-black font-bold" : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
            }`}
          >
            4. Ready
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-[12px] text-red-400 font-mono space-y-1">
          <p className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Installation Error
          </p>
          <p>{error}</p>
        </div>
      )}

      {/* STEP 1: Select File or Popular Game */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Popular 1-Click Game Presets */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                Quick Install from Verified Presets
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">1-Click Setup</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {POPULAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 text-left transition-all cursor-pointer group shadow-xs"
                >
                  <p className="text-[12px] font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] truncate">
                    {preset.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                    {preset.category}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Drag & Drop File Selector */}
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
            className="rounded-2xl border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent-primary)] bg-[var(--bg-surface)] p-10 text-center space-y-4 transition-colors"
          >
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mx-auto text-[var(--accent-primary)]">
              <FolderOpen className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--text-main)]">
                Or Select Any Local Windows Installer
              </h2>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                Drag and drop your <span className="font-mono text-[var(--text-main)] font-semibold">.exe</span> or <span className="font-mono text-[var(--text-main)] font-semibold">.msi</span> file directly into this box
              </p>
            </div>

            <div className="max-w-md mx-auto space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Or paste path e.g. /Users/mac/Downloads/setup.exe"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-sans text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <button
                  disabled={!filePath || analyzing}
                  onClick={() => handleAnalyzeFile(filePath)}
                  className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-[12px] font-medium flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: PE Header Analysis & Recipe Configuration */}
      {step === 2 && analysis && recommendation && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
            <h2 className="text-[13px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider">
              1. Executable Inspection Results
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[12px]">
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] text-[10px] block">FILE / PRESET</span>
                <p className="font-bold text-[var(--text-main)] truncate mt-0.5">{analysis.file_name}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] text-[10px] block">ARCHITECTURE</span>
                <p className="font-bold text-[var(--accent-primary)] mt-0.5">{analysis.arch}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] text-[10px] block">SIZE ESTIMATE</span>
                <p className="font-bold text-[var(--text-main)] mt-0.5">
                  {(analysis.size_bytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                <span className="text-[var(--text-muted)] text-[10px] block">COMPATIBILITY</span>
                <p className="font-bold text-[var(--color-ok)] mt-0.5">{recommendation.compatibility}%</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
            <h2 className="text-[13px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider">
              2. FusionCross Optimal Recipe
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[12px]">
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--accent-primary)] text-[10px]">
                  <Boxes className="w-3.5 h-3.5" /> RECOMMENDED ENGINE
                </div>
                <p className="font-bold text-[var(--text-main)]">{recommendation.runtime_hint}</p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                <div className="flex items-center gap-1.5 text-[var(--color-ok)] text-[10px]">
                  <Cpu className="w-3.5 h-3.5" /> GRAPHICS TRANSLATION
                </div>
                <p className="font-bold text-[var(--text-main)] uppercase">
                  {recommendation.graphics === "d3dmetal" ? "D3DMetal (GPTK)" : recommendation.graphics}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                <div className="flex items-center gap-1.5 text-amber-500 text-[10px]">
                  <FlaskConical className="w-3.5 h-3.5" /> REQUIRED RUNTIMES
                </div>
                <p className="font-bold text-[var(--text-main)] truncate">
                  {recommendation.dependencies.join(", ") || "None (Standard)"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4 shadow-xs">
            <h2 className="text-[13px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider">
              3. Target Bottle Selection
            </h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="bottle_choice"
                  checked={!createNewBottle}
                  onChange={() => setCreateNewBottle(false)}
                  className="accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-main)] font-medium">Use existing bottle:</span>
                <select
                  disabled={createNewBottle}
                  value={selectedBottleId}
                  onChange={(e) => setSelectedBottleId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] disabled:opacity-50"
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
                  className="accent-[var(--accent-primary)]"
                />
                <span className="text-[13px] text-[var(--text-main)] font-medium">Create new isolated bottle:</span>
                <input
                  type="text"
                  disabled={!createNewBottle}
                  value={newBottleName}
                  onChange={(e) => setNewBottleName(e.target.value)}
                  placeholder="Bottle Name"
                  className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-mono text-[var(--text-main)] disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-main)] font-medium text-[12px] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white font-medium text-[12px] flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            >
              Proceed to Install <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Execute Installation */}
      {step === 3 && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-5 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center mx-auto text-[var(--accent-primary)]">
            {installing ? <Loader2 className="w-7 h-7 animate-spin" /> : <Download className="w-7 h-7" />}
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-[var(--text-main)]">
              {installing ? "Installing Windows Application..." : "Ready to Install"}
            </h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1">
              FusionCross will run <span className="font-mono text-[var(--text-main)] font-semibold">{analysis?.file_name}</span> in the selected Wine prefix.
            </p>
          </div>

          <div className="rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] font-mono text-[11px] text-left text-[var(--color-ok)] space-y-1">
            <p>● WinePrefix configuration: Ready</p>
            <p>● DLL Overrides: Auto-configured</p>
            <p>● Graphics API: {recommendation?.graphics.toUpperCase()}</p>
            <p className="text-[var(--text-secondary)] pt-2">{installLog}</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              disabled={installing}
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-secondary)] font-medium text-[12px] disabled:opacity-50 cursor-pointer"
            >
              Back
            </button>
            <button
              disabled={installing}
              onClick={handleRunInstallation}
              className="px-6 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white font-semibold text-[12px] shadow-xs cursor-pointer transition-colors"
            >
              {installing ? "Installing..." : "Execute Installer"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Finish */}
      {step === 4 && (
        <div className="rounded-xl border border-[var(--color-ok)]/30 bg-[var(--color-ok-glow)] p-8 text-center space-y-5 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-ok)]/20 border border-[var(--color-ok)]/30 flex items-center justify-center mx-auto text-[var(--color-ok)]">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-[var(--text-main)]">Installation Completed!</h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-1">
              {installLog}
            </p>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={onFinish}
              className="px-6 py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-semibold shadow-xs cursor-pointer transition-colors"
            >
              Go to Application Library
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

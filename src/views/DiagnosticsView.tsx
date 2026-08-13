import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Loader2,
  RotateCw,
} from "lucide-react";
import {
  applyFix,
  runDiagnostics,
  Application,
  DiagnosticCheck,
  FusionErrorPayload,
} from "../services/tauri";

interface DiagnosticsViewProps {
  applications: Application[];
  onRefreshState: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  applications,
  onRefreshState,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<string>(
    applications.length > 0 ? applications[0].id : ""
  );
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [runningChecks, setRunningChecks] = useState<boolean>(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunChecks = async () => {
    if (!selectedAppId) return;
    setRunningChecks(true);
    setError(null);
    setFixResult(null);
    try {
      const res = await runDiagnostics(selectedAppId);
      setChecks(res);
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Diagnostics failed.");
    } finally {
      setRunningChecks(false);
    }
  };

  const handleApplyFix = async (fixId: string) => {
    setFixing(fixId);
    setError(null);
    try {
      const msg = await applyFix(fixId, selectedAppId);
      setFixResult(msg);
      onRefreshState();
      // Re-run checks
      await handleRunChecks();
    } catch (e) {
      setError((e as FusionErrorPayload).message || "Auto-fix failed.");
    } finally {
      setFixing(null);
    }
  };

  const failedCount = checks.filter((c: DiagnosticCheck) => !c.passed).length;

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-graphite-600/70">
        <div>
          <h1 className="text-[20px] font-bold text-graphite-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-warn" /> Diagnostics & Auto-Fix Engine
          </h1>
          <p className="text-[12px] text-graphite-400">
            PRD §36–37 · 3-Part Error Diagnosis (*What happened / Why / What can I do*) with 1-click Auto-Fix
          </p>
        </div>
      </div>

      {/* Target Application Selector */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <label className="text-[12px] font-mono font-bold text-graphite-400 uppercase">
            Select Application to Diagnose
          </label>
          <select
            value={selectedAppId}
            onChange={(e) => setSelectedAppId(e.target.value)}
            className="w-full md:w-80 px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 font-mono text-[12px] text-graphite-100 focus:outline-none"
          >
            {applications.map((app) => (
              <option key={app.id} value={app.id}>
                {app.name} ({app.category})
              </option>
            ))}
          </select>
        </div>

        <button
          disabled={!selectedAppId || runningChecks}
          onClick={handleRunDiagnostics}
          className="px-5 py-2.5 rounded-lg bg-warn hover:bg-warn/90 text-black font-mono text-[12px] font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {runningChecks ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCw className="w-4 h-4" />
          )}
          Run Health Diagnostics
        </button>
      </div>

      {fixResult && (
        <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 text-[12px] text-ok font-mono whitespace-pre-wrap">
          ✓ Auto-Fix Applied:
          {"\n"}
          {fixResult}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-err/40 bg-err/10 p-4 text-[12px] text-err font-mono">
          ⚠ {error}
        </div>
      )}

      {/* Diagnostic Results List */}
      {checks.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
              Diagnostic Health Checks ({checks.length - failedCount}/{checks.length} Passed)
            </h2>
            {failedCount > 0 && (
              <span className="text-[11px] font-mono text-warn font-bold">
                ⚠ {failedCount} issue(s) detected requiring auto-fix
              </span>
            )}
          </div>

          <div className="space-y-3">
            {checks.map((check: DiagnosticCheck) => (
              <div
                key={check.name}
                className={`rounded-xl border p-4 transition-all ${
                  check.passed
                    ? "bg-graphite-900 border-graphite-700/60"
                    : "bg-warn/5 border-warn/40"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {check.passed ? (
                      <CheckCircle2 className="w-5 h-5 text-ok shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-warn shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 font-mono text-[12px]">
                      <h3 className="font-bold text-graphite-100 text-[13px]">{check.name}</h3>

                      {/* Enforce PRD §78 3-part layout */}
                      <div className="space-y-1 pt-1">
                        <p className="text-graphite-300">
                          <span className="text-graphite-400 font-semibold">What happened: </span>
                          {check.detail}
                        </p>
                        <p className="text-graphite-300">
                          <span className="text-graphite-400 font-semibold">Status: </span>
                          {check.passed ? (
                            <span className="text-ok font-bold">Passed cleanly</span>
                          ) : (
                            <span className="text-warn font-bold">Action required</span>
                          )}
                        </p>

                        {!check.passed && check.suggested_fix && (
                          <div className="pt-2">
                            <span className="text-graphite-400 font-semibold block mb-1">
                              What can I do:
                            </span>
                            <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700 flex items-center justify-between gap-3">
                              <span className="text-accent-400">{check.suggested_fix}</span>
                              <button
                                disabled={fixing === check.suggested_fix}
                                onClick={() => handleApplyFix(check.suggested_fix!)}
                                className="px-3 py-1.5 rounded bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0"
                              >
                                {fixing === check.suggested_fix ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Wrench className="w-3.5 h-3.5" />
                                )}
                                Auto-Fix Now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  function handleRunDiagnostics() {
    handleRunChecks();
  }
};

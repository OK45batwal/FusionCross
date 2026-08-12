import { useEffect, useState } from "react";
import {
  LayoutGrid,
  AppWindow,
  Heart,
  Clock,
  FlaskConical,
  Boxes,
  Cpu,
  Activity,
  Settings,
  Download,
  RefreshCw,
  Terminal,
} from "lucide-react";
import {
  getSystemInfo,
  getState,
  probeRuntime,
  type AppState,
  type SystemInfo,
  type FusionErrorPayload,
} from "./services/tauri";

const navGroups = [
  { label: "LIBRARY", items: [
    { label: "Home", icon: LayoutGrid, active: true },
    { label: "Applications", icon: AppWindow },
    { label: "Favorites", icon: Heart },
    { label: "Recent", icon: Clock },
  ]},
  { label: "ENVIRONMENTS", items: [
    { label: "Bottles", icon: FlaskConical },
    { label: "Runtimes", icon: Boxes },
  ]},
  { label: "TOOLS", items: [
    { label: "Compatibility", icon: Cpu },
    { label: "Diagnostics", icon: Activity },
  ]},
];

interface EngineStatus {
  name: string;
  version?: string;
  error?: FusionErrorPayload;
}

function EngineCard({ engine, onRefresh }: { engine: string; onRefresh: () => void }) {
  const [status, setStatus] = useState<EngineStatus>({ name: engine });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const s = await probeRuntime(engine);
      setStatus({ name: s.name, version: s.version });
    } catch (e) {
      setStatus({ name: engine, error: e as FusionErrorPayload });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-line */ }, [engine]);

  return (
    <div className="rounded-lg border border-graphite-600 bg-graphite-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12px] font-semibold text-graphite-100">{engine}</span>
        <button
          onClick={() => { void load(); onRefresh(); }}
          className="p-1 rounded text-graphite-300 hover:text-graphite-100 transition-colors"
          title="Re-probe"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {status.version ? (
        <p className="text-[12px] text-ok font-mono">● {status.version}</p>
      ) : status.error ? (
        <div className="text-[12px]">
          <p className="text-warn font-mono">⚠ {status.error.message}</p>
          {status.error.action && (
            <p className="text-[11px] text-graphite-300 mt-1">
              Suggested action: <span className="text-accent-400 font-mono">{status.error.action}</span>
            </p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-graphite-400 font-mono">Probing…</p>
      )}
    </div>
  );
}

function App() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [i, s] = await Promise.all([getSystemInfo(), getState()]);
      setInfo(i);
      setState(s);
      setError(null);
    } catch (e) {
      setError((e as FusionErrorPayload).message ?? String(e));
    }
  };

  useEffect(() => { void refresh(); /* eslint-disable-line */ }, []);

  return (
    <div className="flex h-full bg-graphite-950">
      {/* Left rail */}
      <nav className="w-[220px] shrink-0 border-r border-graphite-600/60 flex flex-col bg-graphite-900">
        <div className="px-4 py-4 flex items-center gap-2 border-b border-graphite-600/60">
          <span className="w-6 h-6 rounded-md bg-accent-500 flex items-center justify-center text-[12px] font-bold font-mono text-white">F</span>
          <span className="font-mono text-[13px] font-bold tracking-[2px] text-graphite-100">FUSIONCROSS</span>
        </div>

        <button
          disabled
          title="Install App arrives in the installer layer"
          className="mx-3 mt-4 mb-2 py-2 rounded-md bg-accent-500 hover:brightness-110 active:scale-[0.98] text-white text-[11px] font-mono font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5" /> INSTALL APP
        </button>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 mb-1 text-[10px] font-mono tracking-[1.5px] text-graphite-400">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] transition-colors ${
                      item.active
                        ? "text-graphite-100 bg-graphite-800 border border-graphite-600/60"
                        : "text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/50"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-graphite-600/60 space-y-0.5">
          <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/50 transition-colors">
            <Terminal className="w-3.5 h-3.5" /> Run Command
          </button>
          <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] text-graphite-300 hover:text-graphite-100 hover:bg-graphite-800/50 transition-colors">
            <Settings className="w-3.5 h-3.5" /> Settings
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 shrink-0 px-6 flex items-center justify-between border-b border-graphite-600/60 bg-graphite-900/60">
          <p className="font-mono text-[12px] text-graphite-300">
            BOTTLE MANAGER <span className="text-graphite-400">/</span> <span className="text-graphite-100">HOME</span>
          </p>
          <button
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 text-[11px] font-mono text-graphite-300 hover:text-graphite-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> REFRESH
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <h1 className="text-[20px] font-bold text-graphite-100">Welcome</h1>
            <p className="text-[13px] text-graphite-300">
              Windows applications. Native Mac experience. Foundation build — apps and bottles land in the next layer.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-err/40 bg-err/5 p-4 text-[12px] text-err font-mono">{error}</div>
          )}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="rounded-lg border border-graphite-600 bg-graphite-900 p-4">
              <p className="text-[10px] font-mono tracking-wider text-graphite-400 mb-3">SYSTEM</p>
              <p className="font-mono text-[18px] font-bold text-graphite-100">v{info?.app_version ?? "–"}</p>
              <p className="text-[12px] text-graphite-300 font-mono">
                {info ? `${info.os} · ${info.arch}` : "Loading…"}
              </p>
            </div>
            <div className="rounded-lg border border-graphite-600 bg-graphite-900 p-4">
              <p className="text-[10px] font-mono tracking-wider text-graphite-400 mb-3">APPLICATIONS</p>
              <p className="font-mono text-[18px] font-bold text-graphite-100">{state?.applications.length ?? 0}</p>
              <p className="text-[12px] text-graphite-300 font-mono">registered</p>
            </div>
            <div className="rounded-lg border border-graphite-600 bg-graphite-900 p-4">
              <p className="text-[10px] font-mono tracking-wider text-graphite-400 mb-3">BOTTLES</p>
              <p className="font-mono text-[18px] font-bold text-graphite-100">{state?.bottles.length ?? 0}</p>
              <p className="text-[12px] text-graphite-300 font-mono">environments</p>
            </div>
            <div className="rounded-lg border border-graphite-600 bg-graphite-900 p-4">
              <p className="text-[10px] font-mono tracking-wider text-graphite-400 mb-3">RUNTIMES</p>
              <p className="font-mono text-[18px] font-bold text-graphite-100">
                {(info?.engines.length ?? 0) + (state ? Math.min(state.runtimes.length, 0) : 0)}
              </p>
              <p className="text-[12px] text-graphite-300 font-mono">engines</p>
            </div>
          </div>

          <div>
            <h2 className="text-[11px] font-mono tracking-wider text-graphite-400 mb-2">RUNTIME ENGINES</h2>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {(info?.engines ?? ["Wine Stable", "Wine-GE", "Proton-GE"]).map((engine) => (
                <EngineCard key={engine} engine={engine} onRefresh={() => void refresh()} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
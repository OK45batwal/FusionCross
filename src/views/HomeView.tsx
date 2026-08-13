import React from "react";
import {
  Download,
  FlaskConical,
  Activity,
  Play,
  Square,
  Clock,
  Heart,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { ViewId } from "../components/Sidebar";
import { Application, Bottle, RunningInfo, SystemInfo } from "../services/tauri";

interface HomeViewProps {
  systemInfo: SystemInfo | null;
  applications: Application[];
  bottles: Bottle[];
  runningInfo: RunningInfo[];
  onNavigate: (view: ViewId) => void;
  onLaunchApp: (appId: string) => void;
  onStopApp: (appId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  systemInfo,
  applications,
  bottles,
  runningInfo,
  onNavigate,
  onLaunchApp,
  onStopApp,
}) => {
  const recentApps = [...applications]
    .filter((a) => a.last_played)
    .sort((a, b) => (b.last_played ?? "").localeCompare(a.last_played ?? ""))
    .slice(0, 4);

  const favoriteApps = applications.filter((a) => a.favorite).slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Hero Welcome Banner */}
      <div className="rounded-xl border border-graphite-600 bg-gradient-to-r from-graphite-900 via-graphite-850 to-graphite-900 p-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-accent-500" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-accent-500/10 border border-accent-500/30 text-accent-400 text-[11px] font-mono font-medium">
            <Sparkles className="w-3.5 h-3.5" /> Windows Apps. The Mac Way.
          </div>
          <h1 className="text-[24px] font-bold text-graphite-100 tracking-tight">
            Welcome to FusionCross
          </h1>
          <p className="text-[13px] text-graphite-300 leading-relaxed">
            FusionCross automatically handles Wine runtimes, graphics backends (DXVK & D3DMetal), prefix creation, dependency resolution, and automated diagnostics so you never need to wrestle with Wine.
          </p>
        </div>
      </div>

      {/* Active Running Apps Banner */}
      {runningInfo.length > 0 && (
        <div className="rounded-xl border border-ok/40 bg-ok/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ok animate-pulse" />
              <h2 className="text-[13px] font-mono font-bold text-ok uppercase tracking-wider">
                Active Session ({runningInfo.length})
              </h2>
            </div>
            <button
              onClick={() => onNavigate("applications")}
              className="text-[11px] font-mono text-graphite-300 hover:text-graphite-100 flex items-center gap-1"
            >
              View in Library <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runningInfo.map((info) => (
              <div
                key={info.app_id}
                className="flex items-center justify-between p-3 rounded-lg bg-graphite-900 border border-graphite-600"
              >
                <div>
                  <p className="text-[13px] font-semibold text-graphite-100">{info.name}</p>
                  <p className="text-[11px] font-mono text-graphite-400">
                    PID {info.pid} · Elapsed {info.elapsed_secs}s
                  </p>
                </div>
                <button
                  onClick={() => onStopApp(info.app_id)}
                  className="px-3 py-1.5 rounded-md bg-err/10 border border-err/30 hover:bg-err/20 text-err text-[11px] font-mono font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" /> STOP
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards (PRD §5: Home focuses on actions) */}
      <div>
        <h2 className="text-[11px] font-mono font-semibold tracking-wider text-graphite-400 uppercase mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigate("installer")}
            className="group rounded-xl border border-graphite-600 bg-graphite-900 hover:bg-graphite-850 hover:border-accent-500/50 p-5 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-accent-500/10 text-accent-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="text-[15px] font-bold text-graphite-100">Install Executable</h3>
              <p className="text-[12px] text-graphite-300">
                Drag & drop a <span className="font-mono text-graphite-200">.exe</span> or <span className="font-mono text-graphite-200">.msi</span> file to analyze and auto-configure compatibility.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[12px] font-mono font-semibold text-accent-400">
              Start Installer <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onNavigate("bottles")}
            className="group rounded-xl border border-graphite-600 bg-graphite-900 hover:bg-graphite-850 hover:border-ok/50 p-5 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-ok/10 text-ok flex items-center justify-center group-hover:scale-110 transition-transform">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="text-[15px] font-bold text-graphite-100">Create Environment</h3>
              <p className="text-[12px] text-graphite-300">
                Create an isolated bottle prefix from Gaming, Office, Adobe, or Development templates.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[12px] font-mono font-semibold text-ok">
              New Bottle <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => onNavigate("diagnostics")}
            className="group rounded-xl border border-graphite-600 bg-graphite-900 hover:bg-graphite-850 hover:border-warn/50 p-5 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-lg bg-warn/10 text-warn flex items-center justify-center group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-[15px] font-bold text-graphite-100">Run Diagnostics</h3>
              <p className="text-[12px] text-graphite-300">
                Auto-diagnose launch failures, dependency issues, or graphics issues with 1-click repairs.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-[12px] font-mono font-semibold text-warn">
              Run Checks <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Continue Where You Left Off (Recent Apps) */}
      {recentApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono font-semibold tracking-wider text-graphite-400 uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent-400" /> Recent Applications
            </h2>
            <button
              onClick={() => onNavigate("applications")}
              className="text-[11px] font-mono text-accent-400 hover:underline"
            >
              View All ({applications.length})
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentApps.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-graphite-600 bg-graphite-900 p-4 hover:border-graphite-500 transition-all flex flex-col justify-between"
              >
                <div>
                  <p className="text-[14px] font-bold text-graphite-100 truncate">{app.name}</p>
                  <p className="text-[11px] font-mono text-graphite-400 mt-0.5">{app.category}</p>
                </div>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-graphite-700/60">
                  <span className="text-[10px] font-mono text-graphite-300">
                    Played {app.launch_count}x
                  </span>
                  <button
                    onClick={() => onLaunchApp(app.id)}
                    className="px-2.5 py-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> LAUNCH
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorites */}
      {favoriteApps.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono font-semibold tracking-wider text-graphite-400 uppercase flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-err" /> Favorites
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {favoriteApps.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-graphite-600 bg-graphite-900 p-4 hover:border-graphite-500 transition-all flex flex-col justify-between"
              >
                <div>
                  <p className="text-[14px] font-bold text-graphite-100 truncate">{app.name}</p>
                  <p className="text-[11px] font-mono text-graphite-400 mt-0.5">{app.category}</p>
                </div>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-graphite-700/60">
                  <span className="text-[10px] font-mono text-ok">
                    ● {app.compatibility ?? 90}% Compat
                  </span>
                  <button
                    onClick={() => onLaunchApp(app.id)}
                    className="px-2.5 py-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1"
                  >
                    <Play className="w-3 h-3 fill-current" /> LAUNCH
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Status Overview */}
      <div>
        <h2 className="text-[11px] font-mono font-semibold tracking-wider text-graphite-400 uppercase mb-3">
          System Overview
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-4">
            <div className="flex items-center gap-2 text-graphite-400 mb-2">
              <Cpu className="w-4 h-4 text-accent-400" />
              <span className="text-[10px] font-mono tracking-wider font-semibold">ARCHITECTURE</span>
            </div>
            <p className="font-mono text-[16px] font-bold text-graphite-100 uppercase">
              {systemInfo?.arch ?? "Apple Silicon"}
            </p>
            <p className="text-[11px] font-mono text-graphite-400">macOS {systemInfo?.os ?? "Darwin"}</p>
          </div>

          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-4">
            <div className="flex items-center gap-2 text-graphite-400 mb-2">
              <Layers className="w-4 h-4 text-ok" />
              <span className="text-[10px] font-mono tracking-wider font-semibold">BOTTLES</span>
            </div>
            <p className="font-mono text-[16px] font-bold text-graphite-100">{bottles.length}</p>
            <p className="text-[11px] font-mono text-graphite-400">isolated environments</p>
          </div>

          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-4">
            <div className="flex items-center gap-2 text-graphite-400 mb-2">
              <Download className="w-4 h-4 text-accent-300" />
              <span className="text-[10px] font-mono tracking-wider font-semibold">APPLICATIONS</span>
            </div>
            <p className="font-mono text-[16px] font-bold text-graphite-100">{applications.length}</p>
            <p className="text-[11px] font-mono text-graphite-400">registered in library</p>
          </div>

          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-4">
            <div className="flex items-center gap-2 text-graphite-400 mb-2">
              <Sparkles className="w-4 h-4 text-warn" />
              <span className="text-[10px] font-mono tracking-wider font-semibold">WINE ENGINE</span>
            </div>
            <p className="font-mono text-[16px] font-bold text-graphite-100">Wine Stable / GE</p>
            <p className="text-[11px] font-mono text-ok">Auto Graphics: DXVK/D3DMetal</p>
          </div>
        </div>
      </div>
    </div>
  );
};

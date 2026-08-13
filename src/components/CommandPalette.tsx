import React, { useEffect, useState } from "react";
import {
  Search,
  Download,
  FlaskConical,
  Boxes,
  Cpu,
  Activity,
  Settings,
  AppWindow,
  Globe,
  X,
} from "lucide-react";
import { ViewId } from "./Sidebar";
import { Application, Bottle, Runtime } from "../services/tauri";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId) => void;
  applications: Application[];
  bottles: Bottle[];
  runtimes: Runtime[];
  onLaunchApp: (appId: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  applications,
  bottles,
  runtimes,
  onLaunchApp,
}) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredApps = applications.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredBottles = bottles.filter((b) =>
    b.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredRuntimes = runtimes.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  const navigationCommands = [
    { label: "Install Application", view: "installer" as ViewId, icon: Download },
    { label: "Create Bottle Environment", view: "bottles" as ViewId, icon: FlaskConical },
    { label: "Runtime Manager", view: "runtimes" as ViewId, icon: Boxes },
    { label: "Compatibility Center", view: "compatibility" as ViewId, icon: Cpu },
    { label: "Diagnostics & Auto-Fix", view: "diagnostics" as ViewId, icon: Activity },
    { label: "Website & DB Portal", view: "website" as ViewId, icon: Globe },
    { label: "Application Settings", view: "settings" as ViewId, icon: Settings },
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4">
      <div className="w-full max-w-[620px] rounded-xl border border-graphite-600 bg-graphite-900 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-graphite-600/70 bg-graphite-950/60">
          <Search className="w-4 h-4 text-accent-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search applications, bottles, runtimes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-[13px] font-mono text-graphite-100 placeholder-graphite-400 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-graphite-400 hover:text-graphite-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Results */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans">
          {/* Applications match */}
          {filteredApps.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[10px] font-mono tracking-wider text-graphite-400 font-semibold">
                APPLICATIONS
              </p>
              <div className="space-y-1">
                {filteredApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      onLaunchApp(app.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-850 hover:bg-graphite-800 border border-graphite-700/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <AppWindow className="w-4 h-4 text-accent-400" />
                      <div>
                        <p className="text-[13px] font-medium text-graphite-100">{app.name}</p>
                        <p className="text-[11px] font-mono text-graphite-400">{app.category}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Launch ↵
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Navigation Commands */}
          {navigationCommands.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[10px] font-mono tracking-wider text-graphite-400 font-semibold">
                ACTIONS & TOOLS
              </p>
              <div className="space-y-1">
                {navigationCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <button
                      key={cmd.view}
                      onClick={() => {
                        onNavigate(cmd.view);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-graphite-850 hover:bg-graphite-800 border border-graphite-700/60 transition-colors text-left"
                    >
                      <Icon className="w-4 h-4 text-graphite-300" />
                      <span className="text-[12px] font-medium text-graphite-200">{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottles match */}
          {filteredBottles.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[10px] font-mono tracking-wider text-graphite-400 font-semibold">
                BOTTLE ENVIRONMENTS
              </p>
              <div className="space-y-1">
                {filteredBottles.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onNavigate("bottles");
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-850 hover:bg-graphite-800 border border-graphite-700/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FlaskConical className="w-4 h-4 text-ok" />
                      <span className="text-[12px] font-medium text-graphite-100">{b.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-graphite-400">
                      {b.windows_version} · {b.graphics}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Runtimes match */}
          {filteredRuntimes.length > 0 && (
            <div>
              <p className="px-2 mb-1.5 text-[10px] font-mono tracking-wider text-graphite-400 font-semibold">
                RUNTIMES
              </p>
              <div className="space-y-1">
                {filteredRuntimes.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onNavigate("runtimes");
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-graphite-850 hover:bg-graphite-800 border border-graphite-700/60 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <Boxes className="w-4 h-4 text-warn" />
                      <span className="text-[12px] font-medium text-graphite-100">{r.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-graphite-400">
                      {r.downloaded ? "Installed" : "Available"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-graphite-600/70 bg-graphite-950/60 flex items-center justify-between text-[11px] font-mono text-graphite-400">
          <span>Navigate with ↑ ↓ and Enter</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};

import { useState } from "react";
import { Settings, Shield, Sliders, Info } from "lucide-react";
import { setSafeMode } from "../services/tauri";

interface SettingsViewProps {
  settings: [string, string][];
  onRefreshState: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshState,
}) => {
  const [beginnerMode, setBeginnerMode] = useState<boolean>(true);
  const isSafeModeOn = settings.some(([k, v]) => k === "safe_mode" && v === "on");

  const handleToggleSafeMode = async (enabled: boolean) => {
    await setSafeMode(enabled);
    onRefreshState();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-graphite-600/70">
        <div>
          <h1 className="text-[20px] font-bold text-graphite-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent-400" /> Settings & Preferences
          </h1>
          <p className="text-[12px] text-graphite-400">
            PRD §5 · Beginner / Advanced mode, Safe Mode, and Wine configuration defaults
          </p>
        </div>
      </div>

      {/* Mode Selector Toggle */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold text-graphite-100">User Interface Mode</h2>
            <p className="text-[12px] text-graphite-300 mt-0.5">
              Beginner mode hides raw Wine complexity and auto-manages runtimes and graphics.
            </p>
          </div>

          <div className="flex items-center rounded-lg bg-graphite-850 p-1 border border-graphite-700 font-mono text-[11px]">
            <button
              onClick={() => setBeginnerMode(true)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                beginnerMode ? "bg-accent-500 text-white shadow-sm" : "text-graphite-400"
              }`}
            >
              Beginner Mode (Default)
            </button>
            <button
              onClick={() => setBeginnerMode(false)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                !beginnerMode ? "bg-accent-500 text-white shadow-sm" : "text-graphite-400"
              }`}
            >
              Advanced Mode
            </button>
          </div>
        </div>
      </div>

      {/* Safe Mode Toggle (PRD §5) */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-warn" />
              <h2 className="text-[14px] font-bold text-graphite-100">Safe Mode Execution</h2>
            </div>
            <p className="text-[12px] text-graphite-300">
              Disables DXVK, D3DMetal, custom DLL overrides, and experimental features while keeping full debug logging.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSafeModeOn}
              onChange={(e) => handleToggleSafeMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-graphite-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-warn"></div>
          </label>
        </div>
      </div>

      {/* Advanced Settings with Tooltips (PRD §5) */}
      {!beginnerMode && (
        <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4">
          <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent-400" /> Advanced Controls
          </h2>

          <div className="space-y-3 font-mono text-[12px]">
            <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-graphite-100">Default Windows Architecture</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-accent-400">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-black border border-graphite-600 text-[10px] text-graphite-200 rounded shadow-xl">
                    *What does this do?* Specifies whether new bottles default to 64-bit (win64) or 32-bit (win32) prefix layout.
                  </div>
                </div>
              </div>
              <span className="text-graphite-300">win64 (64-bit)</span>
            </div>

            <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-graphite-100">DXVK HUD Performance Overlay</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-accent-400">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-black border border-graphite-600 text-[10px] text-graphite-200 rounded shadow-xl">
                    *What does this do?* Displays real-time FPS, frame timing, and GPU VRAM utilization on Vulkan/Metal games.
                  </div>
                </div>
              </div>
              <span className="text-graphite-300">DXVK_HUD=compiler,fps</span>
            </div>

            <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-700/60 flex items-center justify-between">
              <div>
                <span className="font-bold text-graphite-100">Automated Log Capture</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-accent-400">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-black border border-graphite-600 text-[10px] text-graphite-200 rounded shadow-xl">
                    *What does this do?* Writes stderr and stdout logs for every launched application into ~/.fusioncross/logs/.
                  </div>
                </div>
              </div>
              <span className="text-ok">Enabled</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

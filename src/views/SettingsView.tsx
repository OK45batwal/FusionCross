import React, { useState } from "react";
import { Settings, Shield, Sliders, Info, FolderOpen, Save, Check } from "lucide-react";
import { setSafeMode, setSetting, openLogsDirectory } from "../services/tauri";
import { errorMessage } from "../services/errors";

interface SettingsViewProps {
  settings: [string, string][];
  onRefreshState: () => void;
  onNotify?: (type: "success" | "error" | "info", message: string, title?: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshState,
  onNotify,
}) => {
  const getSetting = (key: string, defaultVal: string) => {
    const found = settings.find(([k]) => k === key);
    return found ? found[1] : defaultVal;
  };

  const isSafeModeOn = settings.some(([k, v]) => k === "safe_mode" && v === "on");
  const [dxvkHud, setDxvkHud] = useState(() => getSetting("dxvk_hud", "compiler,fps"));
  const [wineBinaryPath, setWineBinaryPath] = useState(() => getSetting("wine_binary_path", ""));
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleToggleSafeMode = async (enabled: boolean) => {
    try {
      await setSafeMode(enabled);
      onRefreshState();
    } catch (cause) {
      onNotify?.("error", errorMessage(cause, "Could not change Safe Mode."), "Settings");
    }
  };

  const handleSaveSetting = async (key: string, val: string) => {
    try {
      await setSetting(key, val);
      setSavedNotice(`Saved ${key}`);
      setTimeout(() => setSavedNotice(null), 2500);
      onRefreshState();
    } catch (cause) {
      setSavedNotice(null);
      onNotify?.("error", errorMessage(cause, "Could not save settings."), "Settings");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-(--border-color)">
        <div>
          <h1 className="text-[20px] font-bold text-(--text-main) flex items-center gap-2">
            <Settings className="w-5 h-5 text-(--accent-primary)" /> Settings
          </h1>
          <p className="text-[13px] text-(--text-muted)">
            Graphics execution, runtime defaults, and log access
          </p>
        </div>

        {savedNotice && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] text-ok bg-(--color-ok-glow) border border-ok/20">
            <Check className="w-3.5 h-3.5" />
            {savedNotice}
          </span>
        )}
      </div>

      {/* Safe Mode Toggle */}
      <div className="rounded-xl border border-(--border-color) bg-(--bg-surface) p-5 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <h2 className="text-[14px] font-bold text-(--text-main)">Safe Mode Execution</h2>
            </div>
            <p className="text-[13px] text-(--text-muted)">
              Skips DXVK/DXMT deployment, D3DMetal registry tweaks, and custom DLL overrides.
              Use it when a game shows a black screen or crashes on launch.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              aria-label="Safe Mode"
              checked={isSafeModeOn}
              onChange={(e) => handleToggleSafeMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-(--border-color) peer-focus-visible:outline-2 peer-focus-visible:outline-(--accent-primary) rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="rounded-xl border border-(--border-color) bg-(--bg-surface) p-5 space-y-4">
        <h2 className="text-[13px] font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-(--accent-primary)" /> Advanced Controls
        </h2>

        <div className="space-y-3 text-[13px]">
          {/* DXVK HUD Setting */}
          <div className="p-3.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-bold text-(--text-main)">DXVK HUD Overlay Preset</span>
              <div className="group relative inline-block ml-2 cursor-pointer text-(--accent-primary)">
                <Info className="w-3.5 h-3.5 inline" aria-hidden="true" />
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-(--bg-surface) border border-(--border-color) text-[12px] text-(--text-main) rounded-md shadow-xl z-50">
                  Displays real-time FPS, frame timing, and GPU VRAM utilization on Vulkan/Metal games.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="DXVK HUD preset"
                value={dxvkHud}
                onChange={(e) => {
                  setDxvkHud(e.target.value);
                  handleSaveSetting("dxvk_hud", e.target.value);
                }}
                className="px-2.5 py-1 rounded-md bg-(--bg-surface) border border-(--border-color) text-(--text-main) text-[13px] cursor-pointer"
              >
                <option value="compiler,fps">compiler,fps (Minimal)</option>
                <option value="fps,frametimes">fps,frametimes (Balanced)</option>
                <option value="full">full (Complete Stats)</option>
                <option value="0">0 (Disabled)</option>
              </select>
            </div>
          </div>

          {/* Custom Wine Binary Path */}
          <div className="p-3.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-(--text-main)">Custom Wine Binary Path</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-(--accent-primary)">
                  <Info className="w-3.5 h-3.5 inline" aria-hidden="true" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-(--bg-surface) border border-(--border-color) text-[12px] text-(--text-main) rounded-md shadow-xl z-50">
                    Override automatic Wine discovery with an explicit path to a wine64 binary.
                  </div>
                </div>
              </div>
              {wineBinaryPath && (
                <button
                  onClick={() => {
                    setWineBinaryPath("");
                    handleSaveSetting("wine_binary_path", "");
                  }}
                  className="text-[12px] text-(--text-muted) hover:text-red-400 cursor-pointer"
                >
                  Clear override
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                aria-label="Custom Wine binary path"
                placeholder="Auto-detected (Whisky / Homebrew / CrossOver)"
                value={wineBinaryPath}
                onChange={(e) => setWineBinaryPath(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md bg-(--bg-surface) border border-(--border-color) text-(--text-main) text-[13px]"
              />
              <button
                onClick={() => handleSaveSetting("wine_binary_path", wineBinaryPath)}
                className="px-3 py-1.5 rounded-md bg-(--accent-primary) hover:bg-(--accent-hover) text-white text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </div>

          {/* Automated Log Capture */}
          <div className="p-3.5 rounded-lg bg-(--bg-elevated) border border-(--border-color) flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-bold text-(--text-main)">Application Logs</span>
              <p className="text-[12px] text-(--text-muted) mt-0.5">
                Every launched game writes stdout and stderr to{" "}
                <span className="font-mono">Application Support/FusionCross/logs/</span>
              </p>
            </div>
            <button
              onClick={() => openLogsDirectory().catch((cause) =>
                onNotify?.("error", errorMessage(cause, "Could not open the logs folder."), "Logs")
              )}
              className="px-3 py-1.5 rounded-md bg-(--bg-surface) hover:bg-(--bg-elevated) border border-(--border-color) text-(--text-main) text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5 text-(--accent-primary)" />
              <span>Open Logs Folder</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

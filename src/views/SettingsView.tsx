import React, { useState } from "react";
import { Settings, Shield, Sliders, Info, FolderOpen, Save, Check } from "lucide-react";
import { setSafeMode, setSetting, openLogsDirectory } from "../services/tauri";

interface SettingsViewProps {
  settings: [string, string][];
  onRefreshState: () => void;
}

const UI_MODE_KEY = "fusioncross-ui-mode";

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshState,
}) => {
  const [beginnerMode, setBeginnerMode] = useState<boolean>(() => {
    return localStorage.getItem(UI_MODE_KEY) !== "advanced";
  });

  const getSetting = (key: string, defaultVal: string) => {
    const found = settings.find(([k]) => k === key);
    return found ? found[1] : defaultVal;
  };

  const isSafeModeOn = settings.some(([k, v]) => k === "safe_mode" && v === "on");
  const [defaultArch, setDefaultArch] = useState(() => getSetting("default_arch", "win64"));
  const [dxvkHud, setDxvkHud] = useState(() => getSetting("dxvk_hud", "compiler,fps"));
  const [wineBinaryPath, setWineBinaryPath] = useState(() => getSetting("wine_binary_path", ""));
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleToggleSafeMode = async (enabled: boolean) => {
    await setSafeMode(enabled);
    onRefreshState();
  };

  const setMode = (beginner: boolean) => {
    setBeginnerMode(beginner);
    localStorage.setItem(UI_MODE_KEY, beginner ? "beginner" : "advanced");
  };

  const handleSaveSetting = async (key: string, val: string) => {
    await setSetting(key, val);
    setSavedNotice(`Saved ${key}`);
    setTimeout(() => setSavedNotice(null), 2500);
    onRefreshState();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-main)] flex items-center gap-2">
            <Settings className="w-5 h-5 text-[var(--accent-primary)]" /> Settings & Preferences
          </h1>
          <p className="text-[12px] text-[var(--text-muted)]">
            Configure UI mode, graphics execution, and runtime defaults
          </p>
        </div>

        {savedNotice && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-[var(--color-ok)] bg-[var(--color-ok-glow)] border border-[var(--color-ok)]/20 animate-fade-in">
            <Check className="w-3.5 h-3.5" />
            {savedNotice}
          </span>
        )}
      </div>

      {/* Mode Selector Toggle */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--text-main)]">User Interface Mode</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
              Beginner mode hides raw Wine complexity and auto-manages runtimes and graphics.
            </p>
          </div>

          <div className="flex items-center rounded-lg bg-[var(--bg-card)] p-1 border border-[var(--border-color)] font-mono text-[11px]">
            <button
              onClick={() => setMode(true)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                beginnerMode
                  ? "bg-[var(--accent-primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              Beginner Mode (Default)
            </button>
            <button
              onClick={() => setMode(false)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                !beginnerMode
                  ? "bg-[var(--accent-primary)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              Advanced Mode
            </button>
          </div>
        </div>
      </div>

      {/* Safe Mode Toggle */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <h2 className="text-[14px] font-bold text-[var(--text-main)]">Safe Mode Execution</h2>
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">
              Disables DXVK, D3DMetal, and custom DLL overrides while keeping full debug logging.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSafeModeOn}
              onChange={(e) => handleToggleSafeMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[var(--border-color)] peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {/* Advanced Settings */}
      {!beginnerMode && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
          <h2 className="text-[12px] font-mono font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--accent-primary)]" /> Advanced Controls
          </h2>

          <div className="space-y-3 font-mono text-[12px]">
            {/* Architecture Setting */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-bold text-[var(--text-main)]">Default Windows Architecture</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-[var(--accent-primary)]">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] rounded-md shadow-xl z-50">
                    Specifies whether new bottles default to 64-bit (win64) or 32-bit (win32) prefix layout.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={defaultArch}
                  onChange={(e) => {
                    setDefaultArch(e.target.value);
                    handleSaveSetting("default_arch", e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] cursor-pointer"
                >
                  <option value="win64">win64 (64-bit default)</option>
                  <option value="win32">win32 (32-bit legacy)</option>
                </select>
              </div>
            </div>

            {/* DXVK HUD Setting */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-bold text-[var(--text-main)]">DXVK HUD Overlay Preset</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-[var(--accent-primary)]">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] rounded-md shadow-xl z-50">
                    Displays real-time FPS, frame timing, and GPU VRAM utilization on Vulkan/Metal games.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={dxvkHud}
                  onChange={(e) => {
                    setDxvkHud(e.target.value);
                    handleSaveSetting("dxvk_hud", e.target.value);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px] cursor-pointer"
                >
                  <option value="compiler,fps">compiler,fps (Minimal)</option>
                  <option value="fps,frametimes">fps,frametimes (Balanced)</option>
                  <option value="full">full (Complete Stats)</option>
                  <option value="0">0 (Disabled)</option>
                </select>
              </div>
            </div>

            {/* Custom Wine Binary Path */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[var(--text-main)]">Custom Wine Binary Path</span>
                  <div className="group relative inline-block ml-2 cursor-pointer text-[var(--accent-primary)]">
                    <Info className="w-3.5 h-3.5 inline" />
                    <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] rounded-md shadow-xl z-50">
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
                    className="text-[11px] text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                  >
                    Clear override
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Auto-detected (Whisky / Homebrew / CrossOver)"
                  value={wineBinaryPath}
                  onChange={(e) => setWineBinaryPath(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-main)] text-[12px]"
                />
                <button
                  onClick={() => handleSaveSetting("wine_binary_path", wineBinaryPath)}
                  className="px-3 py-1.5 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>

            {/* Automated Log Capture */}
            <div className="p-3.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="font-bold text-[var(--text-main)]">Automated Log Capture</span>
                <div className="group relative inline-block ml-2 cursor-pointer text-[var(--accent-primary)]">
                  <Info className="w-3.5 h-3.5 inline" />
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 p-2 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] text-[var(--text-main)] rounded-md shadow-xl z-50">
                    Captures stdout and stderr for every launched game and tool into application logs.
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Logged in Application Support/FusionCross/logs/
                </p>
              </div>
              <button
                onClick={() => openLogsDirectory()}
                className="px-3 py-1.5 rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Open Logs Folder</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

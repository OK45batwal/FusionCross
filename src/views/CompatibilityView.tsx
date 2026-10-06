import React, { useEffect, useState } from "react";
import {
  Cpu,
  Sparkles,
  Search,
  ShieldCheck,
} from "lucide-react";
import { getRecommendation, Recommendation } from "../services/tauri";

const SHOWCASE_APPS = [
  "Cyberpunk 2077",
  "Elden Ring",
  "Baldur's Gate 3",
  "Grand Theft Auto V",
  "The Witcher 3: Wild Hunt",
  "Skyrim Special Edition",
  "Diablo IV",
  "Hades II",
  "Raji: An Ancient Epic",
  "Steam Client",
  "Battle.net Desktop App",
  "Adobe Photoshop 2024",
];

export const CompatibilityView: React.FC = () => {
  const [testAppName, setTestAppName] = useState("");
  const [testedRecommendation, setTestedRecommendation] = useState<Recommendation | null>(null);
  const [profiles, setProfiles] = useState<{ name: string; rec: Recommendation }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SHOWCASE_APPS.map(async (name) => ({ name, rec: await getRecommendation(name) })))
      .then((res) => !cancelled && setProfiles(res))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTestRecommendation = async () => {
    if (!testAppName.trim()) return;
    const rec = await getRecommendation(testAppName.trim());
    setTestedRecommendation(rec);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto space-y-6 text-(--text-main)">
      {/* Title */}
      <div className="flex items-center justify-between pb-4 border-b border-(--border-color)">
        <div>
          <h1 className="text-[20px] font-bold text-(--text-main) flex items-center gap-2">
            <Cpu className="w-5 h-5 text-(--accent-primary)" />
            Compatibility Engine & Recipes
          </h1>
          <p className="text-[12px] text-(--text-secondary) mt-1">
            Automated translation recipes matching Windows games & software to optimal Apple Silicon D3DMetal (GPTK), DXVK, and MSync settings.
          </p>
        </div>
      </div>

      {/* Interactive Recommendation Evaluator */}
      <div className="rounded-xl border border-(--border-color) bg-(--bg-surface) p-5 space-y-4 shadow-xs">
        <h2 className="text-[12px] font-mono font-bold text-(--text-muted) uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-(--accent-primary)" />
          Test Any Windows Game or Executable
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-(--text-muted)" />
            <input
              type="text"
              placeholder="Type any game name e.g. Cyberpunk, Elden Ring, GTA, Valorant, Skyrim, Photoshop..."
              value={testAppName}
              onChange={(e) => setTestAppName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTestRecommendation()}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-(--bg-elevated) border border-(--border-color) text-[12px] font-sans text-(--text-main) placeholder-(--text-muted) focus:outline-none focus:border-(--accent-primary)"
            />
          </div>
          <button
            onClick={handleTestRecommendation}
            className="px-4 py-2 rounded-lg bg-(--accent-primary) hover:bg-(--accent-hover) text-white font-medium text-[12px] shadow-xs cursor-pointer transition-colors"
          >
            Evaluate
          </button>
        </div>

        {testedRecommendation && (
          <div className="rounded-xl bg-(--bg-elevated) p-4.5 border border-(--border-color) space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[14px] text-(--text-main)">
                  Matched Recipe: {testedRecommendation.profile.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-(--accent-primary)/10 text-(--accent-primary) font-semibold">
                  Recipe Found
                </span>
              </div>
              <span
                className={`font-bold font-mono text-[14px] px-2.5 py-0.5 rounded-full ${
                  testedRecommendation.compatibility >= 85
                    ? "bg-(--color-ok-glow) text-ok border border-ok/30"
                    : testedRecommendation.compatibility >= 70
                    ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    : "bg-red-500/10 text-red-500 border border-red-500/30"
                }`}
              >
                {testedRecommendation.compatibility}% Compatibility
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-(--border-color)/60 text-[11px] font-mono">
              <div>
                <span className="text-(--text-muted) block">Wine Runtime:</span>
                <span className="text-(--accent-primary) font-semibold">
                  {testedRecommendation.runtime_hint}
                </span>
              </div>
              <div>
                <span className="text-(--text-muted) block">Graphics Engine:</span>
                <span className="text-ok font-semibold">
                  {testedRecommendation.graphics === "d3dmetal" ? "D3DMetal (GPTK)" : testedRecommendation.graphics.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-(--text-muted) block">Target Windows:</span>
                <span className="text-(--text-main) font-semibold">
                  {testedRecommendation.windows_version.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-(--text-muted) block">Dependencies:</span>
                <span className="text-(--text-secondary) font-semibold">
                  {testedRecommendation.dependencies.length > 0 ? testedRecommendation.dependencies.join(", ") : "None"}
                </span>
              </div>
            </div>

            {testedRecommendation.notes.length > 0 && (
              <div className="pt-2 border-t border-(--border-color)/60 text-[11px]">
                <span className="text-amber-500 font-semibold">Community Guidance: </span>
                <span className="text-(--text-secondary)">{testedRecommendation.notes.join(" ")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Anti-Cheat Transparency Card */}
      <div className="p-4 rounded-xl bg-(--bg-surface) border border-(--border-color) space-y-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-[13px] font-semibold text-(--text-main)">
            macOS Anti-Cheat Architecture Transparency
          </h3>
        </div>
        <p className="text-[12px] text-(--text-secondary) leading-relaxed">
          Windows games that use user-space anti-cheat (Valve VAC, Blizzard Warden, Easy Anti-Cheat in offline mode) run smoothly. Games requiring Windows <strong>ring-0 kernel drivers</strong> (Riot Vanguard, BattlEye kernel mode) cannot execute under macOS kernel security policy. FusionCross identifies these titles immediately to save you time.
        </p>
      </div>

      {/* Featured Profiles Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-mono font-bold text-(--text-muted) uppercase tracking-wider">
            Verified Game & Launcher Recipes
          </h2>
          <span className="text-[11px] font-mono text-(--text-muted)">
            {profiles.length} Verified Highlights
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {profiles.map(({ name, rec }) => (
            <div
              key={name}
              className="rounded-xl border border-(--border-color) bg-(--bg-surface) hover:border-(--border-hover) p-4 space-y-3 flex flex-col justify-between transition-all shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] font-bold text-(--text-main) truncate max-w-42.5">
                    {name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      rec.compatibility >= 85
                        ? "bg-(--color-ok-glow) text-ok border border-ok/30"
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                    }`}
                  >
                    {rec.compatibility}%
                  </span>
                </div>
                <p className="text-[11px] font-mono text-(--text-muted) mt-1">
                  Engine: <span className="text-(--accent-primary) font-semibold">{rec.graphics === "d3dmetal" ? "D3DMetal (GPTK)" : rec.graphics.toUpperCase()}</span>
                </p>
              </div>

              <div className="pt-2 border-t border-(--border-color)/60 font-mono text-[11px] space-y-1">
                <p className="text-(--text-secondary)">
                  <span className="text-(--text-muted)">Runtime: </span>
                  {rec.runtime_hint}
                </p>
                <p className="text-(--text-secondary)">
                  <span className="text-(--text-muted)">Runtimes: </span>
                  {rec.dependencies.length > 0 ? rec.dependencies.join(", ") : "None"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

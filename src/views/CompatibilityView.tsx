import { useEffect, useState } from "react";
import { Cpu, Sparkles } from "lucide-react";
import { getRecommendation, Recommendation } from "../services/tauri";

const KNOWN_APPS = [
  "Adobe Photoshop 2024",
  "Steam Client",
  "Microsoft Office 2021",
  "Autodesk AutoCAD",
  "Notepad++",
  "GIMP Windows Build",
];

export const CompatibilityView: React.FC = () => {
  const [testAppName, setTestAppName] = useState("");
  const [testedRecommendation, setTestedRecommendation] = useState<Recommendation | null>(null);
  const [profiles, setProfiles] = useState<{ name: string; rec: Recommendation }[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(KNOWN_APPS.map(async (name) => ({ name, rec: await getRecommendation(name) })))
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
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-graphite-600/70">
        <div>
          <h1 className="text-[20px] font-bold text-graphite-100 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-accent-400" /> Compatibility Engine (PRD §34)
          </h1>
          <p className="text-[12px] text-graphite-400">
            Local & Remote compatibility database matching applications to optimal Wine runtimes & graphics settings
          </p>
        </div>
      </div>

      {/* Interactive Recommendation Tester */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4 shadow-sm">
        <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent-400" /> Test Application Compatibility Recommendation
        </h2>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type app name e.g. Photoshop, Steam, AutoCAD..."
            value={testAppName}
            onChange={(e) => setTestAppName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTestRecommendation()}
            className="flex-1 px-3 py-2 rounded-lg bg-graphite-850 border border-graphite-700 font-mono text-[12px] text-graphite-100 focus:outline-none focus:border-accent-500"
          />
          <button
            onClick={handleTestRecommendation}
            className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-semibold"
          >
            Evaluate
          </button>
        </div>

        {testedRecommendation && (
          <div className="rounded-lg bg-graphite-950 p-4 border border-graphite-700/60 font-mono text-[12px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-graphite-100">
                Matched Profile: {testedRecommendation.profile}
              </span>
              <span className="text-ok font-bold text-[14px]">
                {testedRecommendation.compatibility}% Score
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-graphite-800 text-[11px]">
              <div>
                <span className="text-graphite-400">Runtime: </span>
                <span className="text-accent-400 font-semibold">{testedRecommendation.runtime_hint}</span>
              </div>
              <div>
                <span className="text-graphite-400">Graphics: </span>
                <span className="text-ok font-semibold">{testedRecommendation.graphics.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-graphite-400">Windows: </span>
                <span className="text-graphite-100">{testedRecommendation.windows_version}</span>
              </div>
            </div>
            {testedRecommendation.notes.length > 0 && (
              <p className="text-[11px] text-warn pt-1">
                Note: {testedRecommendation.notes.join(" ")}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Featured Compatibility Database Cards */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-mono font-bold text-graphite-400 uppercase tracking-wider">
          Compatibility Database Highlights
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(({ name, rec }) => (
            <div
              key={name}
              className="rounded-xl border border-graphite-600 bg-graphite-900 p-4 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[14px] font-bold text-graphite-100">{name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-ok/10 text-ok border border-ok/30">
                    {rec.compatibility}%
                  </span>
                </div>
                <p className="text-[11px] font-mono text-graphite-400 mt-1">
                  Profile: {rec.profile}
                </p>
              </div>

              <div className="pt-3 border-t border-graphite-700/60 font-mono text-[11px] space-y-1">
                <p className="text-graphite-300">
                  <span className="text-graphite-400">Runtime: </span>
                  {rec.runtime_hint}
                </p>
                <p className="text-graphite-300">
                  <span className="text-graphite-400">Graphics: </span>
                  <span className="text-accent-400">{rec.graphics}</span>
                </p>
                <p className="text-graphite-400 text-[10px]">
                  Deps: {rec.dependencies.join(", ") || "None"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

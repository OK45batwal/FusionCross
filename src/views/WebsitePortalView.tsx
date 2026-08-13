import { useState } from "react";
import {
  Download,
  BookOpen,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Code2,
} from "lucide-react";

export const WebsitePortalView: React.FC = () => {
  const [tab, setTab] = useState<
    "overview" | "download" | "compatibility" | "recipes" | "docs"
  >("overview");
  const [dbSearch, setDbSearch] = useState("");

  const recipes = [
    {
      title: "Adobe Photoshop 2024 Recipe",
      author: "FusionCross Core",
      deps: "vcrun2022, corefonts",
      graphics: "D3DMetal (Apple GPTK)",
      notes: "Metadata config recipe only — does not host proprietary installers.",
    },
    {
      title: "Steam Gaming Bottle Recipe",
      author: "Community",
      deps: "corefonts",
      graphics: "DXVK 2.3",
      notes: "Optimized for Steam Direct3D 11 games on M1-M4 Mac hardware.",
    },
    {
      title: "AutoCAD 2023 Workstation Recipe",
      author: "CAD Team",
      deps: "vcrun2019, dotnet48",
      graphics: "DXVK",
      notes: "Sets WINEDLLOVERRIDES for rendering pipeline stability.",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto space-y-6">
      {/* Website Navigation Header */}
      <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-accent-500 flex items-center justify-center text-white font-mono font-bold text-[16px]">
              F
            </span>
            <div>
              <h1 className="text-[18px] font-bold text-graphite-100 font-mono tracking-wide">
                FUSIONCROSS.ORG
              </h1>
              <p className="text-[11px] font-mono text-graphite-400">
                Official Web Portal · Compatibility DB · Recipes · Documentation
              </p>
            </div>
          </div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-mono text-[11px] flex items-center gap-1.5 border border-graphite-700"
          >
            <Code2 className="w-3.5 h-3.5" /> GitHub Repository <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 pt-2 border-t border-graphite-700/60 font-mono text-[12px]">
          {[
            { id: "overview", label: "Overview" },
            { id: "download", label: "Download Center" },
            { id: "compatibility", label: "Compatibility DB" },
            { id: "recipes", label: "Recipes" },
            { id: "docs", label: "Documentation" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                tab === t.id
                  ? "bg-accent-500 text-white font-bold"
                  : "bg-graphite-850 text-graphite-300 hover:bg-graphite-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-graphite-600 bg-gradient-to-br from-graphite-900 via-graphite-850 to-graphite-900 p-8 space-y-4">
            <h2 className="text-[26px] font-bold text-graphite-100 tracking-tight">
              FusionCross — Windows Apps. The Mac Way.
            </h2>
            <p className="text-[14px] text-graphite-300 max-w-2xl leading-relaxed">
              Open source, native Apple Silicon solution for running Windows applications and games seamlessly on macOS without needing to understand Wine configuration.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setTab("download")}
                className="px-5 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-bold flex items-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" /> Download v2.0 for Apple Silicon
              </button>
              <button
                onClick={() => setTab("compatibility")}
                className="px-5 py-2.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-mono text-[12px] font-medium border border-graphite-700"
              >
                Browse Compatibility DB
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-2">
              <Zap className="w-6 h-6 text-accent-400" />
              <h3 className="text-[15px] font-bold text-graphite-100">Zero-Wine Friction</h3>
              <p className="text-[12px] text-graphite-300">
                Automated bottle creation, DLL override setup, graphics selection, and dependency resolution.
              </p>
            </div>

            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-2">
              <ShieldCheck className="w-6 h-6 text-ok" />
              <h3 className="text-[15px] font-bold text-graphite-100">Apple Silicon Metal</h3>
              <p className="text-[12px] text-graphite-300">
                Native support for Apple Game Porting Toolkit D3DMetal and DXVK Vulkan acceleration.
              </p>
            </div>

            <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5 space-y-2">
              <BookOpen className="w-6 h-6 text-warn" />
              <h3 className="text-[15px] font-bold text-graphite-100">Community Recipes</h3>
              <p className="text-[12px] text-graphite-300">
                Sharable metadata configuration recipes without hosting copyrighted binaries.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DOWNLOAD CENTER TAB (PRD §64–66) */}
      {tab === "download" && (
        <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-6 space-y-5">
          <div className="space-y-1">
            <h2 className="text-[18px] font-bold text-graphite-100">Official Release Downloads</h2>
            <p className="text-[12px] text-graphite-400 font-mono">
              PRD §64–66 · GitHub-release backed signed binaries with SHA-256 verification
            </p>
          </div>

          <div className="rounded-lg bg-graphite-950 p-5 border border-graphite-700/60 font-mono text-[12px] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold text-graphite-100">FusionCross v2.0.0 (Apple Silicon DMG)</p>
                <p className="text-graphite-400 text-[11px] mt-0.5">
                  Requires macOS 13.0+ (Ventura, Sonoma, Sequoia) on M1, M2, M3, or M4 chip.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded bg-ok/10 text-ok border border-ok/30 text-[11px] font-bold">
                Latest Release
              </span>
            </div>

            <div className="p-3 rounded bg-graphite-900 border border-graphite-800 text-[11px] text-graphite-300 space-y-1">
              <p>
                <span className="text-graphite-400">File: </span> FusionCross-2.0.0-arm64.dmg
              </p>
              <p className="truncate">
                <span className="text-graphite-400">SHA-256 Checksum: </span>
                <span className="text-accent-400">
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </span>
              </p>
            </div>

            <div className="pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white font-mono text-[12px] font-bold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download DMG from GitHub Releases
              </a>
            </div>
          </div>
        </div>
      )}

      {/* COMPATIBILITY DB TAB */}
      {tab === "compatibility" && (
        <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-graphite-100">Compatibility Database</h2>
              <p className="text-[12px] text-graphite-400 font-mono">
                Community & core team tested macOS application ratings
              </p>
            </div>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite-400" />
              <input
                type="text"
                placeholder="Search web database..."
                value={dbSearch}
                onChange={(e) => setDbSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-graphite-850 border border-graphite-700 text-[12px] font-mono text-graphite-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="divide-y divide-graphite-700/60 rounded-lg border border-graphite-700/60 bg-graphite-950 overflow-hidden font-mono text-[12px]">
            {[
              { app: "Photoshop 2024", score: 88, status: "Good", testedOn: "M2 Max · macOS Sonoma" },
              { app: "Steam Direct3D Games", score: 92, status: "Excellent", testedOn: "M3 Pro · macOS Sequoia" },
              { app: "AutoCAD 2023", score: 74, status: "Mostly Working", testedOn: "M1 Pro · macOS Ventura" },
              { app: "Notepad++ 8.5", score: 98, status: "Excellent", testedOn: "M1 / M2 / M3 / M4" },
            ].map((item) => (
              <div key={item.app} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-bold text-graphite-100">{item.app}</span>
                  <p className="text-[11px] text-graphite-400 mt-0.5">Tested on: {item.testedOn}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-ok/10 text-ok border border-ok/30 font-bold">
                    {item.score}% {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RECIPES TAB (PRD §17) */}
      {tab === "recipes" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-5">
            <h2 className="text-[18px] font-bold text-graphite-100">Configuration Recipes (PRD §17)</h2>
            <p className="text-[12px] text-graphite-400 font-mono mt-1">
              Recipes contain metadata configuration steps, DLL overrides, and verb dependencies — never copyrighted binary installers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recipes.map((r) => (
              <div
                key={r.title}
                className="rounded-xl border border-graphite-600 bg-graphite-900 p-4 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-[14px] font-bold text-graphite-100">{r.title}</h3>
                  <p className="text-[11px] font-mono text-accent-400 mt-0.5">By {r.author}</p>
                  <p className="text-[12px] text-graphite-300 mt-2">{r.notes}</p>
                </div>

                <div className="pt-3 border-t border-graphite-700/60 font-mono text-[11px] space-y-1">
                  <p className="text-graphite-400">Dependencies: {r.deps}</p>
                  <p className="text-ok">Graphics: {r.graphics}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DOCUMENTATION TAB */}
      {tab === "docs" && (
        <div className="rounded-xl border border-graphite-600 bg-graphite-900 p-6 space-y-5">
          <div>
            <h2 className="text-[18px] font-bold text-graphite-100">Documentation & Guides</h2>
            <p className="text-[12px] text-graphite-400 font-mono">
              Getting Started, Installing Apps, Bottle Prefixes, Runtimes & Diagnostics
            </p>
          </div>

          <div className="space-y-4 font-sans text-[13px] text-graphite-200">
            <div className="p-4 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-2">
              <h3 className="font-bold text-graphite-100 text-[14px]">1. Installing Windows Applications</h3>
              <p className="text-[12px] text-graphite-300 leading-relaxed">
                Use the Smart Installer Wizard by dropping a .exe or .msi file. FusionCross inspects the PE header, determines the architecture, selects the optimal Wine runtime (Wine Stable or Wine-GE), configures graphics acceleration (DXVK or D3DMetal), installs required visual C++ dependencies, and registers the app.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-2">
              <h3 className="font-bold text-graphite-100 text-[14px]">2. Bottle Prefixes & Graphics Backends</h3>
              <p className="text-[12px] text-graphite-300 leading-relaxed">
                Bottles isolate Windows software environments. Choose Gaming for DirectX 11/12 graphics acceleration, Office for productivity suites, or Custom for development tools. D3DMetal translates Direct3D directly to Apple Metal for high performance gaming on Apple Silicon.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-graphite-950 border border-graphite-700/60 space-y-2">
              <h3 className="font-bold text-graphite-100 text-[14px]">3. Automated Health Diagnostics & Fixes</h3>
              <p className="text-[12px] text-graphite-300 leading-relaxed">
                If an application fails to open, run Health Diagnostics from the sidebar. The DiagnosticsEngine runs environment checks and produces 1-click FixActions (install missing dependencies, switch graphics backends, or reset prefix state).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

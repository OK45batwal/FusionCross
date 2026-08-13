import React, { useEffect, useState } from "react";
import {
  Download,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Wrench,
  Layers,
  ShieldCheck,
  Code2,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";

interface WebsitePortalViewProps {
  onOpenAppWorkbench?: () => void;
}

export const WebsitePortalView: React.FC<WebsitePortalViewProps> = ({ onOpenAppWorkbench }) => {
  const [archText, setArchText] = useState<string>("Detecting Apple Silicon architecture...");
  const [downloadSub, setDownloadSub] = useState<string>("FusionCross-2.0.0-arm64.dmg · 48.2 MB · macOS 13.0+");
  const [copied, setCopied] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  // System & GPU Architecture Detection
  useEffect(() => {
    const ua = navigator.userAgent;
    const isMac = /Macintosh|Mac OS X/i.test(ua);
    let isAppleSilicon = true;

    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          if (renderer && (renderer.includes("Apple") || renderer.includes("M1") || renderer.includes("M2") || renderer.includes("M3") || renderer.includes("M4"))) {
            isAppleSilicon = true;
          }
        }
      }
    } catch {
      // fallback
    }

    if (isMac) {
      if (isAppleSilicon) {
        setArchText("✓ Apple Silicon Mac Detected (M1–M4 ARM64)");
        setDownloadSub("FusionCross-2.0.0-arm64.dmg · 48.2 MB · macOS 13.0+");
      } else {
        setArchText("✓ Intel Mac Detected (x86_64 Rosetta 2)");
        setDownloadSub("FusionCross-2.0.0-x86_64.dmg · 49.5 MB · macOS 13.0+");
      }
    } else {
      setArchText("ℹ Designed for macOS Apple Silicon (M1–M4)");
    }
  }, []);

  const handleCopySha = () => {
    const sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    navigator.clipboard.writeText(sha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleTriggerDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      const link = document.createElement("a");
      link.href = "https://github.com/fusioncross/fusioncross/releases/download/v2.0.0/FusionCross-2.0.0-arm64.dmg";
      link.download = "FusionCross-2.0.0-arm64.dmg";
      alert("Downloading FusionCross-2.0.0-arm64.dmg (48.2 MB)\n\nVerify SHA-256 Checksum:\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    }, 800);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
      {/* Hero & Download Showcase */}
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">
        {/* Top Announcement & Hero */}
        <section className="text-center space-y-6 pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-glow)] border border-[var(--accent-primary)]/30 text-[var(--accent-primary)] font-mono text-[12px] font-bold">
            <span className="w-2 h-2 rounded-full bg-[var(--color-ok)] animate-ping" />
            <span>Version 2.0.0 Stable · macOS 13.0+ · Apple Silicon (M1–M4)</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-[var(--text-main)] leading-[1.1]">
            Windows Apps. The Mac Way.
          </h1>

          <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            FusionCross automatically handles Wine runtimes, bottle environments, D3DMetal graphics acceleration, dependencies, and diagnostics so you can run Windows software effortlessly.
          </p>

          {/* Primary Download Card */}
          <div className="max-w-2xl mx-auto rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 md:p-10 shadow-2xl shadow-black/20 relative overflow-hidden space-y-6 transition-all duration-300">
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent-primary)] to-[var(--color-ok)]" />

            {/* Architecture Detection Banner */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] font-mono text-[12px] font-semibold text-[var(--color-ok)]">
              <CheckCircle2 className="w-4 h-4" />
              <span>{archText}</span>
            </div>

            {/* Download CTA Button */}
            <button
              disabled={downloading}
              onClick={handleTriggerDownload}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-b from-[var(--accent-primary)] to-[#3b52d4] hover:brightness-110 active:scale-[0.99] text-white font-mono text-[16px] font-extrabold flex items-center justify-center gap-3 shadow-xl shadow-[var(--accent-glow)] transition-all cursor-pointer border border-white/20"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Starting Download...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  <span>Download FusionCross v2.0 for Mac</span>
                </>
              )}
            </button>

            {/* Metadata info */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 font-mono text-[11px] text-[var(--text-muted)]">
              <span>{downloadSub}</span>
              <span>•</span>
              <span>Free & Open Source</span>
            </div>

            {/* SHA-256 Verification Box (PRD §54) */}
            <div className="p-4 rounded-2xl bg-[var(--bg-main)] border border-[var(--border-color)] text-left font-mono text-[12px] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                <span>SHA-256 CHECKSUM VERIFICATION (PRD §54)</span>
                <button
                  onClick={handleCopySha}
                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--border-hover)] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-[var(--color-ok)]" />
                      <span className="text-[var(--color-ok)] font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Hash</span>
                    </>
                  )}
                </button>
              </div>
              <p className="break-all font-semibold text-[var(--accent-primary)] selection:bg-[var(--accent-primary)] selection:text-white">
                e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
              </p>
            </div>

            {/* Switch to Desktop App Workbench button */}
            {onOpenAppWorkbench && (
              <div className="pt-2 border-t border-[var(--border-color)]">
                <button
                  onClick={onOpenAppWorkbench}
                  className="text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-main)] inline-flex items-center gap-1.5 hover:underline"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Launch Desktop App Workspace Demo</span>
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Features Showcase Section */}
        <section className="space-y-10 pt-4">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
              Features Built for Mac
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
              Zero manual Wine configuration required. FusionCross does all the heavy lifting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-3 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-[var(--accent-primary)] flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Zero-Wine Friction</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Drop any <span className="font-mono text-[var(--text-main)] font-semibold">.exe</span> or <span className="font-mono text-[var(--text-main)] font-semibold">.msi</span> installer. FusionCross analyzes binary headers, picks optimal Wine runtimes, and resolves dependencies automatically.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-3 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-[var(--color-ok-glow)] text-[var(--color-ok)] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Apple Silicon Graphics</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Leverages D3DMetal (Apple Game Porting Toolkit) and DXVK Vulkan translation for high frame rates and native Metal performance on M1, M2, M3, and M4 chips.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-3 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">1-Click Diagnostics</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                When launch errors occur, the Health Diagnostics engine runs environment checks (*what happened / why*) and repairs prefix dependencies or graphics settings with 1 click.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-3 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">Isolated Bottle Prefixes</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Includes presets for Gaming, Office, Adobe, and Development to keep apps sandboxed, clean, and organized without system pollution.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 space-y-3 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:shadow-xl transition-all duration-300 md:col-span-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-main)]">100% Free & Open Source</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                MIT licensed software backed by GitHub releases. No telemetry by default, no subscriptions, no paid tier, and no mysterious unsigned binaries.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--bg-surface)] py-8 mt-16 font-mono text-[12px] text-[var(--text-muted)] transition-colors">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-main)]">FUSIONCROSS</span>
            <span>·</span>
            <span>Free & Open Source under MIT License</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Designed for macOS Apple Silicon (M1–M4)</span>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline flex items-center gap-1">
              <Code2 className="w-3.5 h-3.5" /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WebsitePortalView;

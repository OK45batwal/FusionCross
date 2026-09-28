import React, { useState, useEffect } from "react";
import {
  Gamepad2,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  X,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  GameCatalogItem,
  Bottle,
  getGameCatalog,
  installCatalogGame,
  createBottle,
  FusionErrorPayload,
} from "../services/tauri";

interface CatalogViewProps {
  bottles: Bottle[];
  onOpenInstaller: (bottleId: string) => void;
  onRefreshState: () => void | Promise<void>;
  onSelectBottle: (bottleId: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  bottles,
  onOpenInstaller,
  onRefreshState,
  onSelectBottle,
}) => {
  const [catalog, setCatalog] = useState<GameCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedGame, setSelectedGame] = useState<GameCatalogItem | null>(null);

  const [installingId, setInstallingId] = useState<string | null>(null);
  const [targetBottleId, setTargetBottleId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGameCatalog()
      .then((data) => setCatalog(data))
      .catch((err) => console.error("Failed to load game catalog", err));
  }, []);

  const categories = [
    { id: "all", label: "All Items" },
    { id: "Stores & Launchers", label: "Launchers & Stores" },
    { id: "Action & RPG", label: "Action & RPG" },
    { id: "Indie & Classics", label: "Indie Legends" },
    { id: "Shooters & Online", label: "Shooters & MMOs" },
    { id: "Creative & Utilities", label: "Creative Apps" },
  ];

  const filtered = catalog.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.developer.toLowerCase().includes(search.toLowerCase()) ||
      item.graphics_backend.toLowerCase().includes(search.toLowerCase()) ||
      item.directx_version.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;

    const matchesTier =
      selectedTier === "all" || item.tier.toLowerCase() === selectedTier.toLowerCase();

    return matchesSearch && matchesCategory && matchesTier;
  });

  const handleInstallGame = async (game: GameCatalogItem, specificBottleId?: string) => {
    setError(null);
    setNotice(null);

    // If game has direct installer URL, trigger 1-click install
    if (game.installer_url) {
      setInstallingId(game.id);
      try {
        const bid = specificBottleId || targetBottleId || (bottles[0] ? bottles[0].id : undefined);
        const jobId = await installCatalogGame(game.id, bid);
        setNotice(`Downloading & setting up ${game.title}! Job #${jobId.slice(0, 8)} started in background.`);
        await onRefreshState();
        setSelectedGame(null);
      } catch (e) {
        const err = e as FusionErrorPayload;
        setError(err.message || `Failed to start installation for ${game.title}`);
      } finally {
        setInstallingId(null);
      }
    } else {
      // If no direct URL (e.g. paid Steam game), create tailored bottle and guide user
      try {
        const bottleName = `${game.title} Bottle`;
        const existing = bottles.find(
          (b) => b.name.toLowerCase() === bottleName.toLowerCase() || b.name.toLowerCase().includes(game.id)
        );

        let bid = existing ? existing.id : "";
        if (!existing) {
          const created = await createBottle(bottleName, "gaming");
          bid = created.id;
          await onRefreshState();
        }

        onSelectBottle(bid);
        onOpenInstaller(bid);
        setSelectedGame(null);
        setNotice(`Created tailored bottle "${bottleName}". You can now select or drop your game installer!`);
      } catch (e) {
        const err = e as FusionErrorPayload;
        setError(err.message || "Failed to initialize game bottle.");
      }
    }
  };

  const getTierBadge = (tier: string, score: number) => {
    switch (tier.toLowerCase()) {
      case "platinum":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--color-ok-glow)] text-[var(--color-ok)] border border-[var(--color-ok)]/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Platinum ({score}%)
          </span>
        );
      case "gold":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Gold ({score}%)
          </span>
        );
      case "silver":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Silver ({score}%)
          </span>
        );
      case "blocked":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/15 text-red-500 border border-red-500/30 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Blocked ({score}%)
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-color)]">
            {tier} ({score}%)
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200">
      {/* Top Banner / Hero Header */}
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <h1 className="text-[18px] font-bold tracking-tight text-[var(--text-main)]">
                Game & Software Catalog
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)]">
                {catalog.length} Tested Profiles
              </span>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 max-w-2xl leading-relaxed">
              Verified Windows games, launchers, and creative apps optimized for Apple Silicon with Apple Game Porting Toolkit (D3DMetal), DXVK Vulkan, and Mach semaphores.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search 50+ games, developers, backends..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] font-sans text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>
        </div>

        {/* Categories Bar & Tier Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--border-color)]/60">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[var(--accent-primary)] text-white font-semibold shadow-xs"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] border border-[var(--border-color)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-[var(--text-muted)] font-mono">Rating:</span>
            {["all", "platinum", "gold", "silver", "blocked"].map((tier) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-2 py-0.5 rounded capitalize font-mono text-[10px] transition-colors cursor-pointer ${
                  selectedTier === tier
                    ? "bg-[var(--text-main)] text-[var(--bg-main)] font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global Notifications */}
      {notice && (
        <div className="px-6 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-500 text-[11px] font-mono flex items-center justify-between">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} className="hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-500 text-[11px] font-mono flex items-center justify-between">
          <span>⚠ {error}</span>
          <button onClick={() => setError(null)} className="hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)]">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <h3 className="text-[15px] font-bold text-[var(--text-main)]">No games matched your criteria</h3>
            <p className="text-[12px] text-[var(--text-secondary)] max-w-sm">
              Try adjusting your search terms or selecting &quot;All Items&quot;.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("all");
                setSelectedTier("all");
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] text-[var(--text-main)] hover:bg-[var(--border-color)] transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const isDownloading = installingId === item.id;
              const hasDirectInstall = !!item.installer_url;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedGame(item)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] p-4.5 transition-all flex flex-col justify-between space-y-3.5 group shadow-xs cursor-pointer hover:-translate-y-0.5"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <h3 className="text-[14px] font-bold text-[var(--text-main)] group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {item.developer} · {item.category}
                        </p>
                      </div>
                      {getTierBadge(item.tier, item.compatibility)}
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-2 leading-relaxed">
                      {item.notes}
                    </p>
                  </div>

                  {/* Engine Specs Badges */}
                  <div className="pt-2 border-t border-[var(--border-color)] flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                      {item.graphics_backend === "d3dmetal" ? "D3DMetal (GPTK)" : item.graphics_backend.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)]">
                      {item.directx_version}
                    </span>
                    {item.msync_recommended && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-semibold">
                        MSync
                      </span>
                    )}
                    {item.anti_cheat_status === "Singleplayer Only" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                        Offline Only
                      </span>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {item.dependencies.length > 0 ? `${item.dependencies.length} runtimes needed` : "Zero dependencies"}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {hasDirectInstall ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstallGame(item);
                          }}
                          disabled={isDownloading}
                          className="px-3 py-1 rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[11px] font-medium flex items-center gap-1 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3" />
                              <span>1-Click Install</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGame(item);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-main)] text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Info className="w-3 h-3 text-[var(--accent-primary)]" />
                          <span>View Recipe</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Game Detail & Recipe Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-bold text-[var(--text-main)]">
                    {selectedGame.title}
                  </h2>
                  {getTierBadge(selectedGame.tier, selectedGame.compatibility)}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
                  Developer: <span className="text-[var(--text-main)] font-medium">{selectedGame.developer}</span> · {selectedGame.category}
                </p>
              </div>

              <button
                onClick={() => setSelectedGame(null)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Anti-cheat Banner */}
            {selectedGame.anti_cheat_status === "Kernel Driver Incompatible" ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px] flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Kernel-Level Anti-Cheat Incompatible</p>
                  <p className="text-[11px] text-red-300/90 leading-relaxed">
                    This game uses a ring-0 Windows kernel driver (e.g. Vanguard/BattlEye) which cannot run inside Wine or macOS. Running the Windows binary will be blocked by the anti-cheat service.
                  </p>
                </div>
              </div>
            ) : selectedGame.anti_cheat_status === "Singleplayer Only" ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[12px] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Singleplayer / Offline Compatible</p>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    Singleplayer and campaign modes run with full graphics fidelity. Multiplayer matchmaking requiring kernel anti-cheat should be launched with anti-cheat disabled or offline.
                  </p>
                </div>
              </div>
            ) : null}

            {/* Optimal Recipe Matrix */}
            <div className="space-y-2 rounded-xl bg-[var(--bg-elevated)] p-4 border border-[var(--border-color)] font-mono text-[12px]">
              <div className="text-[11px] font-sans font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Optimal Wine & Hardware Configuration
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)]">Graphics Translation: </span>
                  <span className="text-[var(--accent-primary)] font-bold">
                    {selectedGame.graphics_backend === "d3dmetal" ? "D3DMetal (Apple GPTK)" : selectedGame.graphics_backend.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">DirectX Target: </span>
                  <span className="text-[var(--text-main)] font-semibold">{selectedGame.directx_version}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Windows OS Mode: </span>
                  <span className="text-[var(--text-main)] font-semibold">{selectedGame.windows_version.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Mach Synchronization: </span>
                  <span className={selectedGame.msync_recommended ? "text-emerald-500 font-bold" : "text-[var(--text-muted)]"}>
                    {selectedGame.msync_recommended ? "MSync Enabled" : "Standard"}
                  </span>
                </div>
              </div>

              {/* Dependencies & Launch args */}
              <div className="pt-2 border-t border-[var(--border-color)] space-y-1.5 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)]">Required Dependencies: </span>
                  <span className="text-[var(--text-main)]">
                    {selectedGame.dependencies.length > 0 ? selectedGame.dependencies.join(", ") : "None (Out of the box)"}
                  </span>
                </div>
                {selectedGame.launch_arguments.length > 0 && (
                  <div>
                    <span className="text-[var(--text-muted)]">Recommended Launch Args: </span>
                    <span className="text-amber-400 font-semibold">{selectedGame.launch_arguments.join(" ")}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-1">
              <h4 className="text-[12px] font-semibold text-[var(--text-main)]">Community Testing Notes</h4>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                {selectedGame.notes}
              </p>
            </div>

            {/* Target Bottle Selection & Actions */}
            <div className="pt-3 border-t border-[var(--border-color)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <label className="text-[11px] font-medium text-[var(--text-muted)] shrink-0">
                  Target Bottle:
                </label>
                <select
                  value={targetBottleId}
                  onChange={(e) => setTargetBottleId(e.target.value)}
                  className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[12px] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] focus:outline-none focus:border-[var(--accent-primary)] truncate"
                >
                  <option value="">Auto-create or pick default</option>
                  {bottles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.graphics})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedGame(null)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                >
                  Close
                </button>

                {selectedGame.installer_url ? (
                  <button
                    onClick={() => handleInstallGame(selectedGame, targetBottleId)}
                    disabled={installingId === selectedGame.id}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {installingId === selectedGame.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Downloading & Installing...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Install {selectedGame.title}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstallGame(selectedGame, targetBottleId)}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Setup Bottle & Install Game</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

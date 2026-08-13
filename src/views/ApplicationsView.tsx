import React, { useState } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Play,
  Square,
  Heart,
  Activity,
  AlertTriangle,
  AppWindow,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import { Application, Bottle, RunningInfo } from "../services/tauri";
import { ViewId } from "../components/Sidebar";

interface ApplicationsViewProps {
  applications: Application[];
  bottles: Bottle[];
  runningInfo: RunningInfo[];
  onLaunchApp: (appId: string) => void;
  onStopApp: (appId: string) => void;
  onToggleFavorite: (appId: string) => void;
  onNavigate: (view: ViewId) => void;
  filterMode?: "all" | "favorites" | "recent";
}

export const ApplicationsView: React.FC<ApplicationsViewProps> = ({
  applications,
  bottles,
  runningInfo,
  onLaunchApp,
  onStopApp,
  onToggleFavorite,
  onNavigate,
  filterMode = "all",
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const categories = ["all", "games", "productivity", "utilities", "applications"];

  let filtered = applications.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(search.toLowerCase()) ||
      app.category.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || app.category.toLowerCase() === selectedCategory;
    const matchesFilterMode =
      filterMode === "all" ||
      (filterMode === "favorites" && app.favorite) ||
      (filterMode === "recent" && app.last_played !== null);
    return matchesSearch && matchesCategory && matchesFilterMode;
  });

  const getBottleName = (bottleId: string) => {
    const b = bottles.find((b) => b.id === bottleId);
    return b ? b.name : "Default Bottle";
  };

  const isRunning = (appId: string) => runningInfo.some((r) => r.app_id === appId);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header controls */}
      <div className="p-4 border-b border-graphite-600/70 bg-graphite-900/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search & Categories */}
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-graphite-400" />
            <input
              type="text"
              placeholder="Search applications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-graphite-850 border border-graphite-700 text-[12px] font-mono text-graphite-100 placeholder-graphite-400 focus:outline-none focus:border-accent-500"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-colors ${
                  selectedCategory === cat
                    ? "bg-accent-500 text-white font-semibold"
                    : "bg-graphite-800 text-graphite-300 hover:text-graphite-100 hover:bg-graphite-750"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* View Mode Toggle & Install CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-graphite-850 p-1 border border-graphite-700">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${
                viewMode === "grid" ? "bg-graphite-700 text-graphite-100" : "text-graphite-400"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded ${
                viewMode === "list" ? "bg-graphite-700 text-graphite-100" : "text-graphite-400"
              }`}
              title="List View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onNavigate("installer")}
            className="px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1.5"
          >
            + Add Application
          </button>
        </div>
      </div>

      {/* Main Grid/List Container */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 rounded-full bg-graphite-850 border border-graphite-700 flex items-center justify-center text-graphite-400">
              <AppWindow className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-graphite-100">No applications found</h3>
              <p className="text-[12px] text-graphite-400 mt-1 max-w-sm">
                Install a Windows application using the smart installer wizard or adjust your search filter.
              </p>
            </div>
            <button
              onClick={() => onNavigate("installer")}
              className="px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-[12px] font-mono font-semibold"
            >
              Launch Smart Installer
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const score = app.compatibility ?? 88;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className={`group rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between relative ${
                    active
                      ? "bg-ok/5 border-ok/50 shadow-md shadow-ok/10"
                      : "bg-graphite-900 border-graphite-600 hover:border-accent-500/50 hover:bg-graphite-850"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-graphite-800 border border-graphite-700 flex items-center justify-center font-mono font-bold text-accent-400 text-[14px]">
                          {app.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <h3 className="text-[14px] font-bold text-graphite-100 truncate max-w-[140px]">
                            {app.name}
                          </h3>
                          <p className="text-[10px] font-mono text-graphite-400">
                            {getBottleName(app.bottle_id)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(app.id);
                        }}
                        className={`p-1 rounded transition-colors ${
                          app.favorite ? "text-err" : "text-graphite-500 hover:text-graphite-300"
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${app.favorite ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2 mt-3">
                      {active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-ok/10 text-ok border border-ok/30 flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-ok" /> RUNNING
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-graphite-800 text-graphite-300 border border-graphite-700">
                          {app.category}
                        </span>
                      )}

                      {score < 75 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-warn/10 text-warn border border-warn/30 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {score}% Compat
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-ok/10 text-ok border border-ok/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {score}% Compat
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-graphite-700/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-graphite-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {app.launch_count} launches
                    </span>

                    {active ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-err/10 border border-err/30 hover:bg-err/20 text-err text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Square className="w-3 h-3 fill-current" /> STOP
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" /> LAUNCH
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="rounded-xl border border-graphite-600 bg-graphite-900 overflow-hidden divide-y divide-graphite-700/60">
            {filtered.map((app) => {
              const active = isRunning(app.id);
              const score = app.compatibility ?? 88;
              return (
                <div
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="p-3 hover:bg-graphite-850 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-graphite-800 border border-graphite-700 flex items-center justify-center font-mono font-bold text-accent-400 text-[13px]">
                      {app.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <h4 className="text-[13px] font-bold text-graphite-100">{app.name}</h4>
                      <p className="text-[11px] font-mono text-graphite-400">
                        {app.category} · Bottle: {getBottleName(app.bottle_id)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-graphite-400">
                      Score: <span className="text-ok font-semibold">{score}%</span>
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(app.id);
                      }}
                      className={`p-1 rounded ${
                        app.favorite ? "text-err" : "text-graphite-500 hover:text-graphite-300"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${app.favorite ? "fill-current" : ""}`} />
                    </button>

                    {active ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-err/10 border border-err/30 text-err text-[11px] font-mono font-semibold flex items-center gap-1"
                      >
                        <Square className="w-3 h-3 fill-current" /> STOP
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onLaunchApp(app.id);
                        }}
                        className="px-3 py-1 rounded bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-semibold flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" /> LAUNCH
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Application Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl border border-graphite-600 bg-graphite-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/30 flex items-center justify-center font-mono font-bold text-accent-400 text-[18px]">
                  {selectedApp.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <h3 className="text-[18px] font-bold text-graphite-100">{selectedApp.name}</h3>
                  <p className="text-[12px] font-mono text-graphite-400">
                    Category: {selectedApp.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-1 rounded text-graphite-400 hover:text-graphite-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 rounded-lg bg-graphite-950 p-4 border border-graphite-700/60 font-mono text-[12px]">
              <div>
                <span className="text-graphite-400">Bottle: </span>
                <span className="text-graphite-100 font-semibold">{getBottleName(selectedApp.bottle_id)}</span>
              </div>
              <div className="truncate">
                <span className="text-graphite-400">Executable Path: </span>
                <span className="text-accent-400">{selectedApp.executable_path}</span>
              </div>
              <div>
                <span className="text-graphite-400">Launch Count: </span>
                <span className="text-graphite-100">{selectedApp.launch_count}</span>
              </div>
              <div>
                <span className="text-graphite-400">Compatibility Score: </span>
                <span className="text-ok font-bold">{selectedApp.compatibility ?? 88}%</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  setSelectedApp(null);
                  onNavigate("diagnostics");
                }}
                className="px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 text-[11px] font-mono flex items-center gap-1.5 border border-graphite-700"
              >
                <Activity className="w-3.5 h-3.5 text-warn" /> Diagnostics
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onToggleFavorite(selectedApp.id);
                    setSelectedApp({ ...selectedApp, favorite: !selectedApp.favorite });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1 border ${
                    selectedApp.favorite
                      ? "bg-err/10 border-err/30 text-err"
                      : "bg-graphite-800 border-graphite-700 text-graphite-300"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${selectedApp.favorite ? "fill-current" : ""}`} />
                  {selectedApp.favorite ? "Favorited" : "Favorite"}
                </button>

                {isRunning(selectedApp.id) ? (
                  <button
                    onClick={() => {
                      onStopApp(selectedApp.id);
                      setSelectedApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-err/10 border border-err/30 text-err text-[11px] font-mono font-bold flex items-center gap-1.5"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> STOP
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLaunchApp(selectedApp.id);
                      setSelectedApp(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-400 text-white text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md shadow-accent-500/20"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> LAUNCH
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

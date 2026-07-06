import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  Search,
  Play,
  Heart,
  Sparkles,
  FolderOpen,
  X,
  Clock,
  ArrowUpDown,
} from 'lucide-react';

const ICON_COLORS = [
  ['from-neon-indigo/30', 'to-neon-purple/30', 'text-neon-indigo'],
  ['from-neon-pink/30', 'to-neon-rose/30', 'text-neon-pink'],
  ['from-neon-blue/30', 'to-neon-cyan/30', 'text-neon-blue'],
  ['from-neon-green/30', 'to-emerald-500/30', 'text-emerald-400'],
  ['from-amber-500/30', 'to-orange-500/30', 'text-amber-400'],
  ['from-neon-purple/30', 'to-neon-pink/30', 'text-neon-purple'],
  ['from-cyan-500/30', 'to-blue-500/30', 'text-cyan-400'],
  ['from-rose-500/30', 'to-pink-500/30', 'text-rose-400'],
];

function getIconColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

type SortKey = 'name' | 'recent' | 'plays' | 'time';

export const Library: React.FC = () => {
  const { 
    apps,
    bottles,
    launchApp,
    toggleFavorite,
    activeAppId,
    setShowWizard,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const categories = useMemo(() => {
    const set = new Set(apps.map((a) => a.category.toLowerCase()));
    return Array.from(set);
  }, [apps]);

  const filteredApps = useMemo(() => {
    let result = apps.filter((app) => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === 'all' ||
        (activeCategory === 'favorites' && app.favorite) ||
        app.category.toLowerCase() === activeCategory;
      return matchesSearch && matchesCategory;
    });

    result.sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name);
        case 'recent': {
          if (!a.last_played && !b.last_played) return 0;
          if (!a.last_played) return 1;
          if (!b.last_played) return -1;
          return new Date(b.last_played).getTime() - new Date(a.last_played).getTime();
        }
        case 'plays': return b.launch_count - a.launch_count;
        case 'time': return b.play_time_mins - a.play_time_mins;
        default: return 0;
      }
    });

    return result;
  }, [apps, searchQuery, activeCategory, sortKey]);

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 h-full bg-graphite-900/40 relative">
      <div className="h-4 select-none pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Library
          </h1>
          <p className="text-xs text-graphite-400 font-mono mt-1">
            {apps.length} {apps.length === 1 ? 'application' : 'applications'} registered
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-graphite-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input pl-9 pr-8 py-1.5 text-xs w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-graphite-500 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="glass-input py-1.5 px-2.5 text-xs font-mono w-28 cursor-pointer"
          >
            <option value="name">Name</option>
            <option value="recent">Recent</option>
            <option value="plays">Most Played</option>
            <option value="time">Play Time</option>
          </select>

          <button
            onClick={() => setShowWizard(true)}
            className="btn-primary flex items-center gap-1.5 py-1.5 px-3 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 border-b border-graphite-800/20 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold transition-all uppercase tracking-wider whitespace-nowrap ${
            activeCategory === 'all'
              ? 'bg-neon-indigo/15 border border-neon-indigo/30 text-white'
              : 'text-graphite-400 hover:text-graphite-200 hover:bg-graphite-800/30 border border-transparent'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold transition-all uppercase tracking-wider whitespace-nowrap ${
              activeCategory === cat
                ? 'bg-neon-indigo/15 border border-neon-indigo/30 text-white'
                : 'text-graphite-400 hover:text-graphite-200 hover:bg-graphite-800/30 border border-transparent'
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setActiveCategory('favorites')}
          className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold transition-all uppercase tracking-wider whitespace-nowrap flex items-center gap-1 ${
            activeCategory === 'favorites'
              ? 'bg-neon-pink/15 border border-neon-pink/30 text-white'
              : 'text-graphite-400 hover:text-graphite-200 hover:bg-graphite-800/30 border border-transparent'
          }`}
        >
          <Heart className="w-3 h-3" /> Favorites
        </button>
      </div>

      {/* App grid */}
      {filteredApps.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredApps.map((app) => {
            const bottle = bottles.find((b) => b.id === app.bottle_id);
            const [from, to, textColor] = getIconColors(app.name);
            return (
              <div
                key={app.id}
                className="glass-panel rounded-2xl overflow-hidden border-graphite-800/80 hover:border-neon-indigo/30 transition-all duration-300 flex flex-col group"
              >
                {/* Icon area */}
                <div className="relative aspect-square bg-gradient-to-b from-graphite-800 to-graphite-950 flex items-center justify-center border-b border-graphite-800 overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br ${from} ${to} opacity-60 group-hover:opacity-80 transition-opacity duration-300`} />
                  <div className="absolute w-20 h-20 bg-white/5 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500" />
                  <span className={`relative z-10 text-2xl font-bold font-mono ${textColor} group-hover:scale-110 transition-transform duration-300 select-none`}>
                    {getInitials(app.name)}
                  </span>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 z-20 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 backdrop-blur-sm bg-graphite-950/50 transition-all duration-300">
                    <button
                      onClick={() => launchApp(app.id)}
                      disabled={activeAppId !== null}
                      className="p-2.5 bg-neon-indigo hover:bg-neon-indigo/90 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50"
                      title="Launch"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={() => toggleFavorite(app.id)}
                      className={`p-2.5 border rounded-xl active:scale-95 transition-all ${
                        app.favorite
                          ? 'bg-neon-pink/15 text-neon-pink border-neon-pink/30 hover:bg-neon-pink hover:text-white'
                          : 'bg-graphite-800/80 text-graphite-300 border-graphite-700 hover:text-white'
                      }`}
                      title={app.favorite ? 'Unfavorite' : 'Favorite'}
                    >
                      <Heart className={`w-4 h-4 ${app.favorite ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Favorite dot */}
                  {app.favorite && (
                    <div className="absolute top-2 right-2 z-10">
                      <Heart className="w-3 h-3 text-neon-pink fill-neon-pink" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 space-y-2">
                  <h3 className="text-sm font-bold text-white leading-tight truncate group-hover:text-neon-indigo transition-colors">
                    {app.name}
                  </h3>

                  {/* Stat badges */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono text-graphite-400 bg-graphite-800/60 px-1.5 py-0.5 rounded">
                      <Clock className="w-2.5 h-2.5" />
                      {relativeTime(app.last_played)}
                    </span>
                    {app.launch_count > 0 && (
                      <span className="text-[9px] font-mono text-graphite-400 bg-graphite-800/60 px-1.5 py-0.5 rounded">
                        {app.launch_count} {app.launch_count === 1 ? 'play' : 'plays'}
                      </span>
                    )}
                    {app.play_time_mins > 0 && (
                      <span className="text-[9px] font-mono text-graphite-400 bg-graphite-800/60 px-1.5 py-0.5 rounded">
                        {(app.play_time_mins / 60).toFixed(0)}h
                      </span>
                    )}
                  </div>

                  {/* Bottle + Category row */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] font-mono text-graphite-500 bg-graphite-800/40 px-1.5 py-0.5 rounded uppercase font-semibold">
                      {app.category}
                    </span>
                    {bottle && (
                      <span className="text-[9px] font-mono text-graphite-500 truncate max-w-[60%] text-right">
                        {bottle.name.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-16 text-center text-graphite-400 text-sm rounded-2xl border-graphite-800 max-w-xl mx-auto space-y-4">
          <FolderOpen className="w-12 h-12 text-graphite-600 mx-auto" />
          <div className="space-y-1">
            <span className="font-bold text-white">
              {searchQuery || activeCategory !== 'all' ? 'No matches' : 'Your library is empty'}
            </span>
            <p className="text-xs text-graphite-500">
              {searchQuery || activeCategory !== 'all'
                ? 'Try adjusting your search or filter'
                : 'Install your first Windows application to get started'}
            </p>
          </div>
          {!searchQuery && activeCategory === 'all' && (
            <button
              onClick={() => setShowWizard(true)}
              className="btn-secondary mx-auto mt-2"
            >
              <Sparkles className="w-4 h-4" /> Install App
            </button>
          )}
        </div>
      )}
    </div>
  );
};

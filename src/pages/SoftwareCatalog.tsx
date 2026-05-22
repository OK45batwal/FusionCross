import React, { useState } from 'react';
import { useApp } from '../store';
import { 
  Search, 
  Sparkles, 
  Plus, 
  Star, 
  Gamepad2, 
  Layers, 
  Cpu, 
  Compass, 
  CheckCircle,
  HelpCircle,
  FileText,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { SoftwareRecipe } from '../types';

export const SoftwareCatalog: React.FC = () => {
  const { recipes, addCustomRecipe, setShowWizard, setWizardRecipeId } = useApp();
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Custom Recipe Creator State
  const [showCreator, setShowCreator] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<'Games' | 'Productivity' | 'Utilities'>('Games');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newPrefix, setNewPrefix] = useState<string>('gaming');
  const [newRating, setNewRating] = useState<number>(5.0);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  // Filter recipes based on category and search text
  const filteredRecipes = recipes.filter(recipe => {
    const matchesCategory = selectedCategory === 'All' || recipe.category === selectedCategory;
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', 'Games', 'Productivity', 'Utilities'];

  const getPrefixColorBadge = (prefix: string) => {
    switch (prefix) {
      case 'gaming':
        return 'border-neon-pink/45 text-neon-pink bg-neon-pink/10';
      case 'productivity':
        return 'border-neon-indigo/45 text-neon-indigo bg-neon-indigo/10';
      case 'dxvk-optimized':
        return 'border-neon-purple/45 text-neon-purple bg-neon-purple/10';
      default:
        return 'border-graphite-500/40 text-graphite-300 bg-graphite-800/20';
    }
  };

  const handleQuickInstall = (recipeId: string) => {
    setWizardRecipeId(recipeId);
    setShowWizard(true);
  };

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDesc) return;

    addCustomRecipe({
      name: newName,
      category: newCategory,
      description: newDesc,
      recommended_prefix: newPrefix,
      rating: newRating,
      icon: 'generic',
      popular: false
    });

    setFormSuccess(true);
    setNewName('');
    setNewDesc('');
    
    setTimeout(() => {
      setFormSuccess(false);
      setShowCreator(false);
    }, 2000);
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-graphite-900 relative">
      
      {/* Glow decorative graphics */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-neon-indigo/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] rounded-full bg-neon-pink/5 blur-[110px] pointer-events-none z-0" />

      {/* Header Panel */}
      <header className="p-6 border-b border-graphite-800/80 bg-graphite-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4 z-10 select-none">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Compass className="w-6 h-6 text-neon-indigo" />
            Software Store
          </h1>
          <p className="text-xs text-graphite-400">
            Browse and install pre-optimized configurations for thousands of Windows desktop applications.
          </p>
        </div>

        {/* Action Header Items */}
        <div className="flex items-center gap-3">
          {/* Glowing Search Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-graphite-400" />
            <input 
              type="text"
              placeholder="Search store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm bg-graphite-950/70 border border-graphite-800/85 hover:border-graphite-700/80 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/30 rounded-xl w-60 outline-none text-graphite-200 transition-all font-mono"
            />
          </div>

          {/* Toggle Preset Creator */}
          <button
            onClick={() => setShowCreator(!showCreator)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-neon-indigo/40 bg-neon-indigo/10 hover:bg-neon-indigo/20 text-neon-indigo shadow-[0_0_15px_rgba(99,102,241,0.08)] active:scale-95 transition-all duration-150"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Recipe
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 overflow-hidden flex relative z-10">
        
        {/* Catalog Grid View */}
        <div className="flex-1 h-full overflow-y-auto p-6 space-y-6">
          
          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 select-none border-b border-graphite-800/30 pb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                  selectedCategory === cat
                    ? 'border-neon-indigo/50 bg-neon-indigo/15 text-white shadow-neon-indigo/5'
                    : 'border-graphite-800 bg-graphite-950/30 text-graphite-400 hover:border-graphite-750 hover:text-graphite-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Catalog Cards Grid */}
          {filteredRecipes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRecipes.map((recipe) => (
                <div 
                  key={recipe.id}
                  className="glass-panel-glow border-graphite-800/80 hover:border-neon-indigo/35 bg-graphite-950/45 rounded-2xl p-5 flex flex-col justify-between h-[210px] relative group hover:translate-y-[-2px] transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                >
                  {/* Rating & Recommended Prefix Row */}
                  <div className="flex items-center justify-between">
                    {/* Star Score */}
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-[10px] font-mono text-graphite-300 font-bold mt-0.5">
                        {recipe.rating.toFixed(1)}
                      </span>
                    </div>

                    {/* Prefix Type Tag */}
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border tracking-wide uppercase font-mono ${getPrefixColorBadge(recipe.recommended_prefix)}`}>
                      {recipe.recommended_prefix}
                    </span>
                  </div>

                  {/* Icon & Title Block */}
                  <div className="space-y-1.5 my-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-graphite-100 group-hover:text-white transition-colors truncate">
                        {recipe.name}
                      </span>
                      {recipe.popular && (
                        <span className="text-[8px] bg-neon-pink/15 text-neon-pink border border-neon-pink/35 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-graphite-400 line-clamp-3 leading-relaxed">
                      {recipe.description}
                    </p>
                  </div>

                  {/* Lower Action CTA */}
                  <div className="flex items-center justify-between border-t border-graphite-800/40 pt-3.5 select-none">
                    <span className="text-[10px] font-mono text-graphite-400">
                      Category: <strong className="text-graphite-300">{recipe.category}</strong>
                    </span>
                    
                    <button
                      onClick={() => handleQuickInstall(recipe.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neon-indigo/90 hover:bg-neon-indigo hover:scale-105 text-white active:scale-95 transition-all shadow-[0_0_10px_rgba(99,102,241,0.25)]"
                    >
                      Quick Install
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-graphite-800 rounded-2xl bg-graphite-950/15">
              <Sparkles className="w-10 h-10 text-graphite-600 mb-3 animate-pulse" />
              <h3 className="text-sm font-semibold text-graphite-300">No applications match search criteria</h3>
              <p className="text-xs text-graphite-500 mt-1 max-w-sm">
                Try searching for other keywords, checking other filter categories, or create your own custom recipe configuration!
              </p>
            </div>
          )}
        </div>

        {/* Custom Recipe Creator Sidebar Drawer */}
        {showCreator && (
          <div className="w-[340px] h-full border-l border-graphite-800/80 bg-graphite-950/80 backdrop-blur-2xl flex flex-col z-20 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-graphite-800/40 flex items-center justify-between bg-graphite-950/40 select-none">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neon-pink" />
                <span className="text-sm font-bold text-white tracking-wide">Create Custom Recipe</span>
              </div>
              <button
                onClick={() => setShowCreator(false)}
                className="text-graphite-400 hover:text-white p-1 hover:bg-graphite-800/40 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateRecipe} className="flex-1 p-5 space-y-4 overflow-y-auto">
              
              {/* Form Success Indicator */}
              {formSuccess ? (
                <div className="p-4 bg-emerald-950/30 border border-emerald-900/60 text-emerald-400 rounded-xl text-xs flex items-center gap-2.5 animate-bounce">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Recipe created successfully and registered into catalog!</span>
                </div>
              ) : (
                <div className="p-3 bg-neon-indigo/5 border border-neon-indigo/25 text-[11px] text-neon-indigo/90 rounded-xl leading-relaxed flex gap-2">
                  <Cpu className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Custom recipes let you design reusable installation preset templates for any Windows software installer.</span>
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-graphite-400 font-mono tracking-wider">Application Name</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Google Chrome, Winamp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-graphite-950/70 border border-graphite-800 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/20 rounded-xl outline-none text-graphite-200 transition-all font-mono"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-graphite-400 font-mono tracking-wider">Category</label>
                <select
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-graphite-950/70 border border-graphite-800 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/20 rounded-xl outline-none text-graphite-200 transition-all font-mono appearance-none"
                >
                  <option value="Games">Games</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Utilities">Utilities</option>
                </select>
              </div>

              {/* Recommended Prefix */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-graphite-400 font-mono tracking-wider">Optimized Prefix Bottle Profile</label>
                <select
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-graphite-950/70 border border-graphite-800 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/20 rounded-xl outline-none text-graphite-200 transition-all font-mono"
                >
                  <option value="gaming">Gaming Bottle (DXVK + ESYNC)</option>
                  <option value="productivity">Productivity (Standard Win10)</option>
                  <option value="dxvk-optimized">High-End DXVK Graphics (MoltenVK)</option>
                  <option value="lightweight">Lightweight Sandbox</option>
                  <option value="legacy">Legacy (Win7 Compatibility)</option>
                </select>
              </div>

              {/* Star Rating */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-graphite-400 font-mono tracking-wider">Star Rating score</label>
                <input 
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  required
                  placeholder="5.0"
                  value={newRating}
                  onChange={(e) => setNewRating(parseFloat(e.target.value) || 5.0)}
                  className="w-full px-3 py-2 text-xs bg-graphite-950/70 border border-graphite-800 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/20 rounded-xl outline-none text-graphite-200 transition-all font-mono"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-graphite-400 font-mono tracking-wider">Configuration Description</label>
                <textarea 
                  rows={4}
                  required
                  placeholder="Detail the optimization profile, custom dependencies, and recommended install parameters..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-graphite-950/70 border border-graphite-800 focus:border-neon-indigo focus:ring-1 focus:ring-neon-indigo/20 rounded-xl outline-none text-graphite-200 transition-all font-mono resize-none leading-relaxed"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={formSuccess}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-neon-indigo via-neon-purple to-neon-pink hover:opacity-95 shadow-[0_0_15px_rgba(157,78,221,0.2)] active:scale-[0.98] transition-all disabled:opacity-50 select-none mt-2"
              >
                Register & Add to Store
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

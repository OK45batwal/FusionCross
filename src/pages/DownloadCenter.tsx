import React from 'react';
import { useApp } from '../store';
import { 
  DownloadCloud, 
  CheckCircle2, 
  ArrowDownCircle, 
  HardDrive, 
  Search,
  FolderOpen,
  Info
} from 'lucide-react';

export const DownloadCenter: React.FC = () => {
  const { runtimes, downloadRuntime, downloadProgress } = useApp();

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 h-full bg-graphite-900/40">
      <div className="h-4 select-none pointer-events-none" />

      {/* Header */}
      <div className="space-y-1 border-b border-graphite-800/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-white font-mono flex items-center gap-2.5">
          <DownloadCloud className="w-5 h-5 text-neon-blue" /> Download Center
        </h1>
        <p className="text-xs text-graphite-400 font-mono">
          App Store style engine catalog to download compatibility layers, graphics translation components, and hotfixes.
        </p>
      </div>

      {/* Split Cards: Engines vs Helpers */}
      <div className="space-y-8">
        
        {/* Category A: Compatibility Engines */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neon-blue" /> COMPATIBILITY ENGINES (WINE / PROTON)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runtimes
              .filter(r => r.category === 'wine' || r.category === 'proton')
              .map((runtime) => {
                const progress = downloadProgress[runtime.id];
                const isDownloading = progress !== undefined && progress < 100;
                
                return (
                  <div 
                    key={runtime.id}
                    className="glass-panel p-5 rounded-2xl border-graphite-800 hover:border-graphite-750 transition-all flex flex-col justify-between h-44 shadow"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold font-mono tracking-wider bg-graphite-800 border border-graphite-700/60 px-2 py-0.5 rounded uppercase text-graphite-300">
                            {runtime.category}
                          </span>
                          <span className="text-[10px] text-graphite-400 font-mono">v{runtime.version}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white leading-snug truncate mt-1">{runtime.name}</h3>
                        <p className="text-[10px] text-graphite-400 leading-normal max-w-sm">
                          {runtime.category === 'proton' 
                            ? 'Features customized Proton enhancements perfect for 3D DirectX game rendering on macOS.' 
                            : 'Standard system translation compatible with Windows productivity suites and legacy tools.'}
                        </p>
                      </div>

                      <span className="text-xs font-mono text-graphite-400 shrink-0">
                        {(runtime.size_bytes / 1_000_000_000).toFixed(1)} GB
                      </span>
                    </div>

                    {/* Download button / progress bar */}
                    <div className="pt-4 border-t border-graphite-850 flex items-center justify-between gap-4">
                      {isDownloading ? (
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-neon-blue font-bold">DOWNLOADING ENGINE...</span>
                            <span className="text-graphite-300">{progress}%</span>
                          </div>
                          <div className="w-full bg-graphite-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-neon-blue h-full rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      ) : runtime.downloaded ? (
                        <div className="flex items-center gap-1.5 text-xs text-neon-green font-semibold font-mono">
                          <CheckCircle2 className="w-4.5 h-4.5" />
                          <span>PREPARED & ACTIVE</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => downloadRuntime(runtime.id)}
                          className="btn-primary py-1.5 px-4 text-xs font-mono flex items-center gap-1.5 ml-auto"
                        >
                          <ArrowDownCircle className="w-4 h-4" /> DOWNLOAD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Category B: Translation Plug-ins */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-neon-indigo" /> GRAPHICS TRANSLATION COMPONENTS (DXVK)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {runtimes
              .filter(r => r.category === 'dxvk' || r.category === 'moltenvk')
              .map((runtime) => {
                const progress = downloadProgress[runtime.id];
                const isDownloading = progress !== undefined && progress < 100;
                
                return (
                  <div 
                    key={runtime.id}
                    className="glass-panel p-5 rounded-2xl border-graphite-800 hover:border-graphite-750 transition-all flex flex-col justify-between h-40 shadow"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold font-mono tracking-wider bg-graphite-800 border border-graphite-700/60 px-2 py-0.5 rounded uppercase text-graphite-300">
                            {runtime.category}
                          </span>
                          <span className="text-[10px] text-graphite-400 font-mono">v{runtime.version}</span>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1">{runtime.name}</h3>
                      </div>

                      <span className="text-xs font-mono text-graphite-400">
                        {(runtime.size_bytes / 1_000_000).toFixed(0)} MB
                      </span>
                    </div>

                    {/* Download button / progress bar */}
                    <div className="pt-3 border-t border-graphite-850 flex items-center justify-between gap-4">
                      {isDownloading ? (
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-neon-indigo font-bold">COMPILING COMPONENT...</span>
                            <span className="text-graphite-300">{progress}%</span>
                          </div>
                          <div className="w-full bg-graphite-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-neon-indigo h-full rounded-full transition-all duration-150" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      ) : runtime.downloaded ? (
                        <div className="flex items-center gap-1.5 text-xs text-neon-green font-semibold font-mono">
                          <CheckCircle2 className="w-4.5 h-4.5" />
                          <span>INSTALLED & MOUNTED</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => downloadRuntime(runtime.id)}
                          className="btn-primary py-1.5 px-4 text-xs font-mono flex items-center gap-1.5 ml-auto"
                        >
                          <ArrowDownCircle className="w-4 h-4" /> DOWNLOAD
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

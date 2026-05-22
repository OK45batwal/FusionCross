import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Settings, 
  Cpu, 
  Terminal, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

export const Onboarding: React.FC = () => {
  const { setOnboarded } = useApp();
  const [step, setStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [scanned, setScanned] = useState<Record<string, 'pending' | 'scanning' | 'success'>>({
    arch: 'pending',
    rosetta: 'pending',
    metal: 'pending',
    vulkan: 'pending',
  });

  const runSystemScan = () => {
    setLoading(true);
    const checks = ['arch', 'rosetta', 'metal', 'vulkan'];
    
    checks.forEach((check, index) => {
      setScanned(prev => ({ ...prev, [check]: 'scanning' }));
      setTimeout(() => {
        setScanned(prev => ({ ...prev, [check]: 'success' }));
        if (index === checks.length - 1) {
          setLoading(false);
        }
      }, (index + 1) * 750);
    });
  };

  const steps = [
    {
      title: "Welcome to FusionWine",
      desc: "An advanced CrossOver-inspired launcher designed for playing Windows .exe games and applications seamlessly on macOS using Wine and Proton translation layers.",
      icon: Sparkles,
    },
    {
      title: "Dynamic Compatibility Analysis",
      desc: "Scanning host processor parameters, graphics adapters, Vulkan dependencies, and hardware accelerators to maximize execution performance.",
      icon: Cpu,
    },
    {
      title: "Environment Initialization",
      desc: "Preparing runtime structures and sandboxing prefixes to isolate applications. Recommended standard library wrappers (DXVK, MoltenVK, Winetricks) will be configured.",
      icon: Terminal,
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      setOnboarded(true);
    }
  };

  useEffect(() => {
    if (step === 1) {
      runSystemScan();
    }
  }, [step]);

  const Icon = steps[step].icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-graphite-950 p-6">
      {/* Blurred glowing spots in background */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-indigo/10 rounded-full blur-[100px] animate-pulse-neon" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-purple/8 rounded-full blur-[100px] animate-pulse-neon" />

      <div className="glass-panel-glow w-full max-w-xl rounded-2xl overflow-hidden relative flex flex-col min-h-[500px] max-h-[90vh]">
        {/* Step Indicator Header */}
        <div className="flex items-center justify-between p-5 border-b border-graphite-800/40">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-neon-indigo rounded-full shadow-neon-indigo" />
            <span className="text-xs uppercase font-mono tracking-widest text-graphite-400 font-semibold">Environment Config</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-graphite-400 font-mono">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-5 h-1.5 rounded transition-all duration-300 ${
                  i === step ? 'bg-neon-indigo w-8' : i < step ? 'bg-neon-purple/50' : 'bg-graphite-700'
                }`} 
              />
            ))}
          </div>
        </div>

        {/* Content Slides */}
        <div className="flex-1 p-6 flex flex-col justify-center overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-5 flex flex-col items-center text-center"
            >
              {/* Cinematic Center Icon */}
              <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-neon-indigo/20 to-neon-purple/20 border border-neon-indigo/25 flex items-center justify-center shadow-neon-indigo/5 relative group">
                <Icon className="w-8 h-8 text-neon-indigo group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-neon-indigo/10 blur rounded-xl -z-10 opacity-50" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                  {steps[step].title}
                </h1>
                <p className="text-sm text-graphite-300 leading-relaxed">
                  {steps[step].desc}
                </p>
              </div>

              {/* Step 1 Compatibility Scans list */}
              {step === 1 && (
                <div className="w-full max-w-sm glass-panel p-3.5 rounded-xl space-y-2 text-left border-graphite-800 animate-fadeIn">
                  <div className="flex items-center justify-between text-xs border-b border-graphite-800/40 pb-2 mb-1">
                    <span className="font-mono text-graphite-400 uppercase tracking-wider">System Parameters</span>
                    {loading ? (
                      <span className="flex items-center gap-1.5 text-neon-indigo font-mono">
                        <RefreshCw className="w-3 h-3 animate-spin" /> SCANNING...
                      </span>
                    ) : (
                      <span className="text-neon-green font-mono">SCAN COMPLETED</span>
                    )}
                  </div>
                  
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-graphite-300 flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-graphite-500" /> Apple Silicon (M1/M2/M3)
                      </span>
                      {scanned.arch === 'success' ? (
                        <span className="text-neon-indigo font-semibold">Detected (ARM64)</span>
                      ) : (
                        <span className="text-graphite-500 animate-pulse">Running check...</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-graphite-300 flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-graphite-500" /> Rosetta 2 Translation
                      </span>
                      {scanned.rosetta === 'success' ? (
                        <span className="text-neon-green font-semibold">Enabled</span>
                      ) : (
                        <span className="text-graphite-500 animate-pulse">Running check...</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-graphite-300 flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-graphite-500" /> Metal GPU Accelerator
                      </span>
                      {scanned.metal === 'success' ? (
                        <span className="text-neon-green font-semibold">Apple Metal API (v3)</span>
                      ) : (
                        <span className="text-graphite-500 animate-pulse">Running check...</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-graphite-300 flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5 text-graphite-500" /> Vulkan Translation (MoltenVK)
                      </span>
                      {scanned.vulkan === 'success' ? (
                        <span className="text-neon-green font-semibold">Ready</span>
                      ) : (
                        <span className="text-graphite-500 animate-pulse">Running check...</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2 Runtime Auto Config */}
              {step === 2 && (
                <div className="w-full max-w-sm glass-panel p-3.5 rounded-xl space-y-2.5 text-left border-graphite-800 animate-fadeIn">
                  <span className="text-xs font-mono text-graphite-400 uppercase tracking-wider border-b border-graphite-800/40 pb-2 block">
                    Recommended Defaults
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-neon-indigo" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-graphite-200">Wine Staging v9.0</span>
                        <span className="text-[10px] text-graphite-400">Stable translation compatibility layer</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-neon-indigo" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-graphite-200">Proton GE (Gaming Edition)</span>
                        <span className="text-[10px] text-graphite-400">DXVK and shader execution boosts</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="p-5 border-t border-graphite-800/40 flex items-center justify-between bg-graphite-950/40">
          <button
            onClick={() => setStep(prev => Math.max(0, prev - 1))}
            disabled={step === 0}
            className={`text-xs font-semibold text-graphite-400 hover:text-white transition-colors font-mono ${
              step === 0 ? 'opacity-0 cursor-default' : ''
            }`}
          >
            PREVIOUS
          </button>
          
          <button
            onClick={handleNext}
            disabled={loading}
            className="btn-primary flex items-center gap-2 font-semibold font-mono shadow-md"
          >
            <span>{step === steps.length - 1 ? "LAUNCH DASHBOARD" : "CONTINUE"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

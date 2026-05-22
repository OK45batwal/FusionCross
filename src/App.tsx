import React from 'react';
import { AppProvider, useApp } from './store';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { BottleManager } from './pages/BottleManager';
import { PerformanceMonitor } from './pages/PerformanceMonitor';
import { DownloadCenter } from './pages/DownloadCenter';
import { Settings } from './pages/Settings';
import { InstallWizard } from './pages/InstallWizard';
import { SoftwareCatalog } from './pages/SoftwareCatalog.tsx'; // Pre-optimized configurations store

const AppContent: React.FC = () => {
  const { onboarded, activeTab, showWizard, setShowWizard } = useApp();

  if (!onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-graphite-900 select-none relative">
      
      {/* Installation Wizard overlay modal */}
      <InstallWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />
      
      {/* Decorative top title-bar border glow */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-neon-indigo via-neon-purple to-neon-pink opacity-80 z-40" />

      {/* Primary Sidebar Layout */}
      <Sidebar />

      {/* Main Panel Routing */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        
        {/* macOS Window Controls Drag Placeholder */}
        <div className="absolute top-0 inset-x-0 h-10 bg-transparent select-none cursor-default z-30 pointer-events-none" />
        
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'library' && <Library />}
        {activeTab === 'catalog' && <SoftwareCatalog />}
        {activeTab === 'bottles' && <BottleManager />}
        {activeTab === 'performance' && <PerformanceMonitor />}
        {activeTab === 'downloads' && <DownloadCenter />}
        {activeTab === 'settings' && <Settings />}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

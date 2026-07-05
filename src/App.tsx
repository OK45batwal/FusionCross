import React, { useMemo } from 'react';
import { AppProvider, useApp } from './store';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { Library } from './pages/Library';
import { BottleManager } from './pages/BottleManager';
import { Settings } from './pages/Settings';
import { InstallWizard } from './pages/InstallWizard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Notifications } from './components/Notifications';
import { useKeyboard } from './hooks/useKeyboard';

const TAB_KEYS: Record<string, string> = {
  '1': 'bottles', '2': 'library', '3': 'settings',
};

const TAB_REDIRECT: Record<string, string> = {
  'catalog': 'library',
  'performance': 'settings',
  'downloads': 'bottles',
};

const AppContent: React.FC = () => {
  const { onboarded, loading, activeTab: rawTab, setActiveTab, showWizard, setShowWizard, notifications, dismissNotification } = useApp();

  const activeTab = useMemo(() => TAB_REDIRECT[rawTab] || rawTab, [rawTab]);

  useKeyboard([
    { key: 'Escape', handler: () => setShowWizard(false) },
    { key: 'k', meta: true, handler: () => setActiveTab('dashboard') },
    ...Object.entries(TAB_KEYS).map(([key, tab]) => ({ key, meta: true, handler: () => setActiveTab(tab) })),
  ]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-graphite-900">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 rounded-full border-2 border-neon-purple border-t-transparent animate-spin mx-auto" />
          <p className="text-sm font-mono text-graphite-400">Loading FusionCross...</p>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-graphite-900 select-none relative">
      
      {/* Installation Wizard overlay modal */}
      <InstallWizard isOpen={showWizard} onClose={() => setShowWizard(false)} />
      
      {/* Notifications */}
      <Notifications items={notifications} onDismiss={dismissNotification} />
      
      {/* Decorative top title-bar border glow */}
      <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-neon-indigo via-neon-purple to-neon-pink opacity-80 z-40" />

      {/* Primary Sidebar Layout */}
      <Sidebar />

      {/* Main Panel Routing */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        <ErrorBoundary>
        
        {/* macOS Window Controls Drag Placeholder */}
        <div className="absolute top-0 inset-x-0 h-10 bg-transparent select-none cursor-default z-30 pointer-events-none" />
        
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'library' && <Library />}
        {activeTab === 'bottles' && <BottleManager />}
        {activeTab === 'settings' && <Settings />}
        </ErrorBoundary>
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

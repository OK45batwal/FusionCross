import { useState } from 'react';
import { Runtime } from '../types';

const isTauri = () =>
  typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

export function useRuntimes() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const downloadRuntime = async (id: string) => {
    setDownloadProgress((prev) => ({ ...prev, [id]: 0 }));
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('trigger_runtime_download', { id });
    } else {
      let prog = 0;
      const interval = setInterval(() => {
        prog += Math.floor(Math.random() * 15) + 5;
        if (prog >= 100) {
          prog = 100;
          clearInterval(interval);
          setRuntimes((prev) => prev.map((r) => (r.id === id ? { ...r, downloaded: true } : r)));
        }
        setDownloadProgress((prev) => ({ ...prev, [id]: prog }));
      }, 200);
    }
  };

  const runtimeBrowserFallback = () => {
    setRuntimes([
      {
        id: 'wine-stable',
        name: 'Wine Stable 9.0',
        category: 'wine',
        version: '9.0.0',
        size_bytes: 840000000,
        downloaded: true,
        path: '~/Library/Application Support/FusionCross/runtimes/wine-stable',
        download_url: 'https://dl.winehq.org/wine-builds/macosx/pipeline/wine-stable-9.0.tar.gz',
      },
      {
        id: 'proton-ge',
        name: 'Proton GE 9.0 (Custom Gaming)',
        category: 'proton',
        version: 'GE-9.0-1',
        size_bytes: 1280000000,
        downloaded: true,
        path: '~/Library/Application Support/FusionCross/runtimes/proton-ge',
        download_url: 'https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-1/GE-Proton9-1.tar.gz',
      },
      {
        id: 'proton-exp',
        name: 'Proton Experimental',
        category: 'proton',
        version: 'Experimental',
        size_bytes: 1420000000,
        downloaded: false,
        path: '~/Library/Application Support/FusionCross/runtimes/proton-exp',
        download_url: 'https://github.com/GloriousEggroll/proton-ge-custom/releases/download/GE-Proton9-1/GE-Proton9-1.tar.gz',
      },
      {
        id: 'dxvk-23',
        name: 'DXVK Translation Layer v2.3',
        category: 'dxvk',
        version: '2.3.0',
        size_bytes: 28000000,
        downloaded: true,
        path: '~/Library/Application Support/FusionCross/runtimes/dxvk-23',
        download_url: 'https://github.com/doitsujin/dxvk/releases/download/v2.3/dxvk-2.3.tar.gz',
      },
      {
        id: 'dxvk-latest',
        name: 'DXVK Master (Nightly Build)',
        category: 'dxvk',
        version: 'Git-Nightly',
        size_bytes: 31000000,
        downloaded: false,
        path: '~/Library/Application Support/FusionCross/runtimes/dxvk-latest',
        download_url: 'https://github.com/doitsujin/dxvk/releases/latest/download/dxvk.tar.gz',
      },
    ]);
  };

  return {
    runtimes,
    setRuntimes,
    downloadProgress,
    setDownloadProgress,
    downloadRuntime,
    runtimeBrowserFallback,
  };
}

import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  handler: () => void;
}

export function useKeyboard(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const metaMatch = s.meta ? e.metaKey : true;
        const ctrlMatch = s.ctrl ? e.ctrlKey : true;
        const noMods = !s.meta && !s.ctrl ? !e.metaKey && !e.ctrlKey && !e.altKey : true;

        if (e.key === s.key && metaMatch && ctrlMatch && noMods) {
          e.preventDefault();
          s.handler();
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}

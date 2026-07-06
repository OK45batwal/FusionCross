import React, { useEffect, useRef } from 'react';

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  handler: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const menuX = Math.min(x, window.innerWidth - 200);
  const menuY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-graphite-900/95 backdrop-blur-2xl border border-graphite-700/60 rounded-xl shadow-2xl shadow-black/40 py-1.5 animate-scale-in"
      style={{ left: menuX, top: menuY }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          onClick={() => { if (!item.disabled) { item.handler(); onClose(); } }}
          disabled={item.disabled}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-mono transition-all ${
            item.danger
              ? 'text-red-400 hover:bg-red-950/30 hover:text-red-300'
              : 'text-graphite-300 hover:bg-graphite-800/60 hover:text-white'
          } ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

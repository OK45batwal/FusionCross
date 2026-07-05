import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  accent?: 'purple' | 'indigo' | 'pink' | 'green';
  height?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnEsc?: boolean;
}

const accentBorders: Record<string, string> = {
  purple: 'border-neon-purple/20',
  indigo: 'border-neon-indigo/20',
  pink: 'border-neon-pink/20',
  green: 'border-neon-green/20',
};

const accentShadows: Record<string, string> = {
  purple: 'shadow-[0_0_50px_rgba(157,78,221,0.15)]',
  indigo: 'shadow-[0_0_50px_rgba(99,102,241,0.15)]',
  pink: 'shadow-[0_0_50px_rgba(247,37,133,0.15)]',
  green: 'shadow-[0_0_50px_rgba(6,214,160,0.15)]',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen, onClose, title, icon, accent = 'purple', height = 'h-[520px]',
  children, footer, closeOnEsc = true,
}) => {
  useEffect(() => {
    if (!closeOnEsc || !isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in-up">
      <div
        className={`glass-panel-glow w-full max-w-lg rounded-2xl overflow-hidden flex flex-col ${height} relative bg-graphite-950/90 ${accentBorders[accent]} ${accentShadows[accent]}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-graphite-800/40 bg-graphite-950/40 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            <span className="font-bold text-white font-mono text-sm uppercase truncate">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-graphite-800 rounded-lg text-graphite-400 hover:text-white transition-all shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-graphite-800/40 bg-graphite-950/40 flex items-center justify-between shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

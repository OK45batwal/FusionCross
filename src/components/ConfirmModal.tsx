import React from 'react';

interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 bg-graphite-950/80 backdrop-blur-sm flex items-center justify-center p-6">
    <div className="glass-panel-glow w-full max-w-md rounded-2xl overflow-hidden border-neon-purple/20 bg-graphite-950/90 shadow-[0_0_50px_rgba(157,78,221,0.15)]">
      <div className="p-6">
        <p className="text-sm text-white font-mono leading-relaxed">{message}</p>
      </div>
      <div className="flex justify-end gap-3 p-4 border-t border-graphite-800/40">
        <button onClick={onCancel} className="btn-secondary py-2 px-4 text-xs font-mono">Cancel</button>
        <button onClick={onConfirm} className="btn-danger py-2 px-4 text-xs font-mono">Confirm</button>
      </div>
    </div>
  </div>
);

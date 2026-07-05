import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
}) => {
  const accent = variant === 'danger' ? 'pink' : 'purple';

  const iconColor = variant === 'danger' ? 'text-neon-pink' : 'text-neon-purple';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      icon={<AlertTriangle className={`w-4 h-4 ${iconColor}`} />}
      accent={accent}
      height="h-auto"
      footer={
        <div className="flex gap-3 w-full justify-end">
          <button onClick={onCancel} className="btn-secondary py-2 px-4 text-xs">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn-base py-2 px-4 text-xs text-white ${
              variant === 'danger'
                ? 'bg-red-500/20 border border-red-500/40 hover:bg-red-500/30'
                : 'bg-neon-purple/20 border border-neon-purple/40 hover:bg-neon-purple/30'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-graphite-300 font-mono leading-relaxed">{message}</p>
    </ModalShell>
  );
};

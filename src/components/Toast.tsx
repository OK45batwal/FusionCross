import React, { useEffect } from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "info" | "success" | "error" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration ?? 4500);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const config = {
    error: {
      border: "border-red-500/30",
      bg: "bg-[var(--bg-surface)]",
      indicator: "bg-red-500",
      icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
      defaultTitle: "Error",
    },
    success: {
      border: "border-emerald-500/30",
      bg: "bg-[var(--bg-surface)]",
      indicator: "bg-emerald-500",
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
      defaultTitle: "Success",
    },
    warning: {
      border: "border-amber-500/30",
      bg: "bg-[var(--bg-surface)]",
      indicator: "bg-amber-500",
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
      defaultTitle: "Notice",
    },
    info: {
      border: "border-[var(--border-color)]",
      bg: "bg-[var(--bg-surface)]",
      indicator: "bg-[var(--accent-primary)]",
      icon: <Info className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" />,
      defaultTitle: "Notification",
    },
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-xl border ${config.border} ${config.bg} p-3.5 shadow-2xl backdrop-blur-xl animate-fade-in flex items-start gap-3 text-[12px] font-sans transition-all duration-200`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.indicator}`} />
      {config.icon}
      <div className="flex-1 min-w-0 pr-2">
        <p className="font-semibold text-[var(--text-main)] text-[12px] leading-tight">
          {toast.title || config.defaultTitle}
        </p>
        <p className="text-[var(--text-secondary)] text-[11px] mt-0.5 break-words leading-relaxed font-mono">
          {toast.message}
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-md hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer shrink-0"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

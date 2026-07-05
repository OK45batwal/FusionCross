import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface Notification {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
}

export const Notifications: React.FC<{
  items: Notification[];
  onDismiss: (id: string) => void;
}> = ({ items, onDismiss }) => {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((n) => (
        <NotificationToast key={n.id} notification={n} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const NotificationToast: React.FC<{
  notification: Notification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  const bg = notification.type === 'error'
    ? 'border-red-500/30 bg-red-950/90'
    : notification.type === 'success'
    ? 'border-neon-green/30 bg-green-950/90'
    : 'border-neon-blue/30 bg-blue-950/90';

  const accent = notification.type === 'error'
    ? 'text-red-400'
    : notification.type === 'success'
    ? 'text-neon-green'
    : 'text-neon-blue';

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id]);

  return (
    <div className={`glass-panel rounded-xl border ${bg} p-3 flex items-start gap-2 shadow-lg animate-in slide-in-from-right`}>
      <p className={`text-xs font-mono flex-1 ${accent}`}>{notification.message}</p>
      <button onClick={() => onDismiss(notification.id)} className="text-graphite-400 hover:text-white shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

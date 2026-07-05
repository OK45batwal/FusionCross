import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-8 text-center animate-fade-in-up">
    <div className="w-16 h-16 rounded-2xl bg-graphite-800/50 border border-graphite-700/40 flex items-center justify-center mb-5">
      <Icon className="w-8 h-8 text-graphite-500" />
    </div>
    <h3 className="text-base font-bold text-graphite-300 font-mono">{title}</h3>
    {description && <p className="text-xs text-graphite-500 font-mono mt-2 max-w-xs">{description}</p>}
    {action && (
      <button onClick={action.onClick} className="btn-primary mt-6 text-xs py-2 px-4">
        {action.label}
      </button>
    )}
  </div>
);

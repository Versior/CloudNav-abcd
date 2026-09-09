import React from 'react';

export type StatusChipTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusChipProps {
  children: React.ReactNode;
  tone?: StatusChipTone;
  className?: string;
}

const toneClasses: Record<StatusChipTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const StatusChip: React.FC<StatusChipProps> = ({ children, tone = 'neutral', className = '' }) => (
  <span data-status-chip data-status-tone={tone} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]} ${className}`}>
    {children}
  </span>
);

export default StatusChip;

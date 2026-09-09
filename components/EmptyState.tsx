import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title = '这里还没有内容',
  description = '添加内容后，它会出现在这里。',
  action,
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    data-ui-state="empty"
    className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40 ${className}`}
  >
    <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
      <Inbox size={18} />
    </span>
    <strong className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</strong>
    <span className="mt-1 max-w-md text-xs leading-5 text-slate-400">{description}</span>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;

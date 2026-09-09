import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = '内容加载失败',
  description = '暂时无法获取内容，请稍后重试。',
  onRetry,
  retryLabel = '重试',
  className = '',
}) => (
  <div
    role="alert"
    aria-live="assertive"
    data-ui-state="error"
    className={`flex min-h-32 flex-col items-center justify-center rounded-2xl border border-rose-200/80 bg-rose-50/60 px-5 py-8 text-center dark:border-rose-900/60 dark:bg-rose-950/20 ${className}`}
  >
    <span aria-hidden="true" className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-500 dark:bg-rose-950/50 dark:text-rose-300">
      <AlertCircle size={18} />
    </span>
    <strong className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</strong>
    <span className="mt-1 max-w-md text-xs leading-5 text-slate-400">{description}</span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 text-xs font-bold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300">
        <RefreshCw size={14} />
        {retryLabel}
      </button>
    )}
  </div>
);

export default ErrorState;

import React from 'react';

export interface LoadingStateProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  title = '正在加载',
  description = '正在准备内容，请稍候。',
  className = '',
}) => (
  <div
    role="status"
    aria-live="polite"
    data-ui-state="loading"
    className={`flex min-h-32 items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-900/60 ${className}`}
  >
    <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600 dark:border-blue-900 dark:border-t-blue-400" />
    <span className="text-left">
      <strong className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</strong>
      <span className="mt-1 block text-xs text-slate-400">{description}</span>
    </span>
  </div>
);

export default LoadingState;

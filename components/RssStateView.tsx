import React from 'react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

export type RssStateViewKind = 'loading' | 'empty' | 'error' | 'offline';

export interface RssStateViewProps {
  state: RssStateViewKind;
  title: string;
  description: string;
  onRetry?: () => void;
}

const RssStateView: React.FC<RssStateViewProps> = ({ state, title, description, onRetry }) => {
  const action = onRetry ? (
    <button type="button" onClick={onRetry} className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">
      刷新来源
    </button>
  ) : undefined;

  return (
    <div data-rss-region="state" data-rss-state={state} className="px-6 py-12">
      {state === 'loading' && <LoadingState title={title} description={description} />}
      {state === 'error' && <ErrorState title={title} description={description} onRetry={onRetry} retryLabel="刷新来源" />}
      {(state === 'empty' || state === 'offline') && <EmptyState title={title} description={description} action={action} />}
    </div>
  );
};

export default RssStateView;

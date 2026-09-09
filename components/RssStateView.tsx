import React from 'react';
import { AlertCircle, RefreshCw, Rss } from 'lucide-react';

export type RssStateViewKind = 'loading' | 'empty' | 'error' | 'offline';

export interface RssStateViewProps {
  state: RssStateViewKind;
  title: string;
  description: string;
  onRetry?: () => void;
}

const RssStateView: React.FC<RssStateViewProps> = ({ state, title, description, onRetry }) => (
  <div data-rss-region="state" data-rss-state={state} className="flex flex-col items-center justify-center px-6 py-20 text-center">
    <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${state === 'error' ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/30' : 'bg-blue-50 text-blue-500 dark:bg-blue-950/30'}`}>
      {state === 'error' ? <AlertCircle size={25} /> : <Rss size={25} />}
    </div>
    <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    {onRetry && <button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><RefreshCw size={14} />刷新来源</button>}
  </div>
);

export default RssStateView;

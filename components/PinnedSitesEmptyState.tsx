import React from 'react';
import { FolderOpen, Plus } from 'lucide-react';

export interface PinnedSitesEmptyStateProps {
  onAdd: () => void;
  onBrowse: () => void;
}

const PinnedSitesEmptyState: React.FC<PinnedSitesEmptyStateProps> = ({ onAdd, onBrowse }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-800/60">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-300"><FolderOpen size={22} /></div>
    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">还没有置顶入口</h3>
    <p className="mt-2 max-w-sm text-xs leading-6 text-slate-400">把常用网站固定在这里，打开 CloudNav 就能直接进入。</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      <button type="button" onClick={onAdd} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700"><Plus size={14} />添加置顶入口</button>
      <button type="button" onClick={onBrowse} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:border-blue-200 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><FolderOpen size={14} />前往分类目录</button>
    </div>
  </div>
);

export default PinnedSitesEmptyState;

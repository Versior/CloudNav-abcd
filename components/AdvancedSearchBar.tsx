import React from 'react';
import { X, Filter } from 'lucide-react';

interface AdvancedSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  tags: string[];
  workspaces: string[];
  filters: {
    status?: string;
    tag?: string;
    hasNote?: boolean;
    broken?: boolean;
    untagged?: boolean;
  };
  onFilterChange: (filters: Record<string, string | boolean | undefined>) => void;
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'unread', label: '未读' },
  { value: 'read', label: '已读' },
  { value: 'favorite', label: '收藏' },
  { value: 'archived', label: '归档' },
];

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({ isOpen, onClose, tags, filters, onFilterChange }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1"><Filter size={12} /> 高级筛选</span>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"><X size={14} /></button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">状态</label>
          <select value={filters.status || ''} onChange={e => onFilterChange({ status: e.target.value || undefined })}
            className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {tags.length > 0 && (
          <div>
            <label className="text-xs text-slate-500 mb-1 block">标签</label>
            <select value={filters.tag || ''} onChange={e => onFilterChange({ tag: e.target.value || undefined })}
              className="w-full p-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              {tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!filters.hasNote} onChange={e => onFilterChange({ hasNote: e.target.checked || undefined })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">有备注</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!filters.untagged} onChange={e => onFilterChange({ untagged: e.target.checked || undefined })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">无标签</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!filters.broken} onChange={e => onFilterChange({ broken: e.target.checked || undefined })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">仅失效链接</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSearchBar;

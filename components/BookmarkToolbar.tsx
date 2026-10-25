import React from 'react';
import { AlertCircle, ArrowDownAZ, ArrowUpAZ, Check, CheckSquare, LayoutGrid, List, Loader2, PencilRuler, Rows3, Square } from 'lucide-react';
import { SORT_OPTIONS, type SortConfig, type SortKey } from '../services/sorting';
import type { CardStyle } from '../types';

export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
const SYNC_LABEL: Record<SyncState, string> = { idle: '', saving: '保存中', saved: '已保存', error: '未保存', conflict: '待处理冲突' };

interface BookmarkToolbarProps {
  title: string;
  count: number;
  /** 当前分类下的全量条目数，用于“全选/取消全选”判定。 */
  total: number;
  cardStyle: CardStyle;
  sort: SortConfig;
  arrangeMode: boolean;
  selectedCount: number;
  /** 云同步状态；非 idle 时在标题旁给出轻量提示。 */
  syncStatus?: SyncState;
  onCardStyleChange: (style: CardStyle) => void;
  onSortChange: (config: SortConfig) => void;
  onToggleArrange: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const STYLE_BUTTONS: Array<{ style: CardStyle; label: string; icon: React.ReactNode }> = [
  { style: 'detailed', label: '详情', icon: <LayoutGrid size={13} /> },
  { style: 'simple', label: '简约', icon: <Rows3 size={13} /> },
  { style: 'list', label: '列表', icon: <List size={13} /> },
];

const BookmarkToolbar: React.FC<BookmarkToolbarProps> = ({
  title, count, total, cardStyle, sort, arrangeMode, selectedCount, syncStatus = 'idle',
  onCardStyleChange, onSortChange, onToggleArrange, onSelectAll, onClearSelection,
}) => {
  const [sortOpen, setSortOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!sortOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setSortOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSortOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [sortOpen]);

  const activeOption = SORT_OPTIONS.find(option => option.key === sort.key) || SORT_OPTIONS[0];
  const allSelected = total > 0 && selectedCount === total;

  const pickSort = (key: SortKey) => {
    // 再次点击同一键切换升降序，切到新键时沿用当前方向语义。
    onSortChange(key === sort.key
      ? { key, direction: sort.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'manual' ? 'asc' : 'asc' });
    setSortOpen(false);
  };

  return (
    <div className="mb-4 flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{title}</h2>
        {syncStatus !== 'idle' && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${syncStatus === 'error' || syncStatus === 'conflict'
            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'}`}>
            {syncStatus === 'saving' ? <Loader2 size={9} className="animate-spin" /> : null}
            {syncStatus === 'saved' ? <Check size={9} /> : null}
            {syncStatus === 'error' || syncStatus === 'conflict' ? <AlertCircle size={9} /> : null}
            <span>{SYNC_LABEL[syncStatus] ?? ''}</span>
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
          {count}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* 排序 */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setSortOpen(open => !open)}
              aria-expanded={sortOpen}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${sortOpen
                ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {sort.direction === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpAZ size={13} />}
              <span className="hidden sm:inline">{activeOption.label}</span>
            </button>

            {sortOpen && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                {SORT_OPTIONS.map(option => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => pickSort(option.key)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${option.key === sort.key
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/50'}`}
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {option.key === sort.key
                        ? (sort.direction === 'asc' ? <ArrowDownAZ size={12} /> : <ArrowUpAZ size={12} />)
                        : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12px] font-medium">{option.label}</span>
                      <span className="block text-[10px] text-slate-400">{option.hint}</span>
                    </span>
                  </button>
                ))}
                <div className="mt-1 border-t border-slate-100 px-2.5 pb-1 pt-1.5 text-[10px] text-slate-400 dark:border-slate-700">
                  点击当前项可切换升降序
                </div>
              </div>
            )}
          </div>

          {/* 视图切换 */}
          <div className="flex items-center rounded-lg bg-slate-100 p-0.5 dark:bg-slate-700/60">
            {STYLE_BUTTONS.map(item => (
              <button
                key={item.style}
                type="button"
                onClick={() => onCardStyleChange(item.style)}
                aria-pressed={cardStyle === item.style}
                className={`flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] font-medium transition-all ${cardStyle === item.style
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-600 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
          </div>

          {/* 整理 */}
          <button
            type="button"
            onClick={onToggleArrange}
            aria-pressed={arrangeMode}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${arrangeMode
              ? 'border-blue-500 bg-blue-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            <PencilRuler size={13} />
            <span className="hidden sm:inline">{arrangeMode ? '完成' : '整理'}</span>
          </button>
        </div>
      </div>

      {arrangeMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300"
          >
            {allSelected ? <CheckSquare size={13} /> : <Square size={13} />}
            {allSelected ? '取消全选' : '全选'}
          </button>
          <span className="text-[11px] text-slate-400">已选 {selectedCount} / {total}</span>
          {selectedCount > 0 && (
            <button type="button" onClick={onClearSelection} className="text-[11px] text-slate-400 hover:text-slate-600">清空</button>
          )}
        </div>
      )}
    </div>
  );
};

export default BookmarkToolbar;

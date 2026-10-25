import React from 'react';
import { LayoutGrid, Lock, Plus, Pin, Settings, X } from 'lucide-react';
import type { Category } from '../types';
import Icon from './Icon';

interface SidebarProps {
  navTitle: string;
  categories: Category[];
  selectedCategory: string;
  /** 各分类下的书签数（含子分类），用于右侧计数。 */
  counts: Record<string, number>;
  totalCount: number;
  pinnedCount: number;
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onSelectCategory: (category: Category) => void;
  onCategoryContextMenu: (event: React.MouseEvent, category: Category) => void;
  onCreateCategory: () => void;
  onOpenSettings: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  navTitle, categories, selectedCategory, counts, totalCount, pinnedCount,
  open, onClose, onSelect, onSelectCategory, onCategoryContextMenu, onCreateCategory, onOpenSettings,
}) => {
  const parents = categories.filter(category => !category.parentId);
  const childrenOf = (id: string) => categories.filter(category => category.parentId === id);

  const itemClass = (active: boolean) => `group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${active
    ? 'bg-blue-50 font-medium text-blue-600 dark:bg-blue-900/25 dark:text-blue-300'
    : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-700/40'}`;

  const count = (value: number) => (
    <span className="ml-auto text-[11px] font-normal tabular-nums text-slate-400 dark:text-slate-500">{value || ''}</span>
  );

  const renderCategory = (category: Category, depth: number) => {
    const active = selectedCategory === category.id;
    return (
      <React.Fragment key={category.id}>
        <button
          type="button"
          onClick={() => onSelectCategory(category)}
          onContextMenu={event => onCategoryContextMenu(event, category)}
          className={itemClass(active)}
          style={depth ? { paddingLeft: 12 + depth * 14 } : undefined}
        >
          <IconSlot name={category.icon} active={active} />
          <span className="min-w-0 flex-1 truncate text-left">{category.name}</span>
          {category.password && <Lock size={11} className="shrink-0 text-amber-500" />}
          {count(counts[category.id] || 0)}
        </button>
        {childrenOf(category.id).map(child => renderCategory(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 transform flex-col border-r border-slate-200/80 bg-white transition-transform duration-200 lg:static lg:translate-x-0 dark:border-slate-700/60 dark:bg-slate-800 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-700/60">
          <span className="truncate text-[15px] font-semibold tracking-tight text-slate-800 dark:text-slate-100">{navTitle || 'CloudNav'}</span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-700" aria-label="关闭导航">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
          <button type="button" onClick={() => onSelect('all')} className={itemClass(selectedCategory === 'all')}>
            <LayoutGrid size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">全部链接</span>
            {count(totalCount)}
          </button>
          <button type="button" onClick={() => onSelect('pinned')} className={itemClass(selectedCategory === 'pinned')}>
            <Pin size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">置顶</span>
            {count(pinnedCount)}
          </button>

          <div className="flex items-center justify-between px-3 pb-1 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">分类</span>
            <button type="button" onClick={onCreateCategory} aria-label="新建分类" className="rounded p-0.5 text-slate-400 hover:text-blue-600">
              <Plus size={13} />
            </button>
          </div>
          {parents.map(category => renderCategory(category, 0))}
          {parents.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-slate-400">还没有分类</p>
          )}
        </nav>

        <div className="border-t border-slate-100 p-2.5 dark:border-slate-700/60">
          <button type="button" onClick={onOpenSettings} className={itemClass(false)}>
            <Settings size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">设置</span>
          </button>
        </div>
      </aside>
    </>
  );
};

/** 分类图标：复用统一 Icon 组件，未设置图标时退回文件夹。 */
const IconSlot: React.FC<{ name?: string; active: boolean }> = ({ name, active }) => (
  <Icon name={name || 'Folder'} size={15} className={active ? 'shrink-0' : 'shrink-0 opacity-70'} />
);

export default React.memo(Sidebar);

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
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

/** 分类图标：复用统一 Icon 组件，未设置图标时退回文件夹。 */
const IconSlot: React.FC<{ name?: string; active: boolean }> = ({ name, active }) => (
  <Icon name={name || 'Folder'} size={15} className={active ? 'shrink-0' : 'shrink-0 opacity-70'} />
);

/** 可接收书签的分类行：拖入时高亮，作为移动目标。 */
const DroppableCategory: React.FC<{
  id: string;
  label: string;
  active: boolean;
  depth: number;
  icon?: string;
  locked?: boolean;
  countText: string;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}> = ({ id, label, active, depth, icon, locked, countText, onClick, onContextMenu }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ${isOver
        ? 'bg-accent-soft text-accent ring-1 ring-accent/40'
        : active
          ? 'bg-accent-soft font-medium text-accent'
          : 'text-ink-soft hover:bg-raised'}`}
      style={depth ? { paddingLeft: 12 + depth * 14 } : undefined}
    >
      <IconSlot name={icon} active={active || isOver} />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {locked && <Lock size={11} className="shrink-0 text-warn" />}
      <span className="ml-auto text-[11px] font-normal tabular-nums text-ink-muted">{countText}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({
  navTitle, categories, selectedCategory, counts, totalCount, pinnedCount,
  open, onClose, onSelect, onSelectCategory, onCategoryContextMenu, onCreateCategory, onOpenSettings,
}) => {
  const parents = categories.filter(category => !category.parentId);
  const childrenOf = (id: string) => categories.filter(category => category.parentId === id);

  const itemClass = (active: boolean) => `group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${active
    ? 'bg-accent-soft font-medium text-accent'
    : 'text-ink-soft hover:bg-raised'}`;

  const renderCategory = (category: Category, depth: number) => (
    <React.Fragment key={category.id}>
      <DroppableCategory
        id={category.id}
        label={category.name}
        active={selectedCategory === category.id}
        depth={depth}
        icon={category.icon}
        locked={!!category.password}
        countText={counts[category.id] ? String(counts[category.id]) : ''}
        onClick={() => onSelectCategory(category)}
        onContextMenu={event => onCategoryContextMenu(event, category)}
      />
      {childrenOf(category.id).map(child => renderCategory(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 transform flex-col border-r border-line bg-sunken transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <span className="truncate text-[15px] font-semibold tracking-tight text-ink">{navTitle || 'CloudNav'}</span>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ink-muted hover:bg-raised lg:hidden" aria-label="关闭导航">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2.5">
          <button type="button" onClick={() => onSelect('all')} className={itemClass(selectedCategory === 'all')}>
            <LayoutGrid size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">全部链接</span>
            <span className="ml-auto text-[11px] tabular-nums text-ink-muted">{totalCount || ''}</span>
          </button>
          <button type="button" onClick={() => onSelect('pinned')} className={itemClass(selectedCategory === 'pinned')}>
            <Pin size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">置顶</span>
            <span className="ml-auto text-[11px] tabular-nums text-ink-muted">{pinnedCount || ''}</span>
          </button>

          <div className="flex items-center justify-between px-3 pb-1 pt-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">分类</span>
            <button type="button" onClick={onCreateCategory} aria-label="新建分类" className="rounded p-0.5 text-ink-muted hover:text-accent">
              <Plus size={13} />
            </button>
          </div>

          {parents.map(category => renderCategory(category, 0))}
          {parents.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-ink-muted">还没有分类</p>
          )}
        </nav>

        <div className="border-t border-line p-2.5">
          <button type="button" onClick={onOpenSettings} className={itemClass(false)}>
            <Settings size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">设置</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default React.memo(Sidebar);

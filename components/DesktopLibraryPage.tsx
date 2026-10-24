import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpRight, BookmarkPlus, Bot, Check,
  ChevronsDown, ChevronsUp, Edit3, Link2, MoreHorizontal, Pin, PinOff,
  Plus, Search, Trash2, X,
} from 'lucide-react';
import type { AIConfig, Category, LinkItem } from '../types';

export interface DesktopLibraryPageProps {
  links: LinkItem[];
  pinnedLinks: LinkItem[];
  displayedLinks: LinkItem[];
  otherCategoryResults: Record<string, LinkItem[]>;
  categories: Category[];
  selectedCategory: string;
  searchQuery: string;
  isBatchEditMode: boolean;
  selectedLinks: Set<string>;
  aiConfig: AIConfig;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onOpen: (link: LinkItem) => void;
  onDetails: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
  onMoveLink?: (link: LinkItem, direction: 'top' | 'up' | 'down' | 'bottom') => void;
  onSaveToReadLater?: (link: LinkItem) => void;
  onTogglePin: (link: LinkItem, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
  onToggleBatchMode: () => void;
  onToggleSelection: (linkId: string) => void;
  onSelectAll: () => void;
  onBatchDelete: () => void;
  onExitBatchMode: () => void;
}

const categoryPath = (categoryId: string, categories: Category[]) => {
  const category = categories.find(item => item.id === categoryId);
  if (!category) return '未分类';
  if (!category.parentId) return category.name;
  return `${categories.find(item => item.id === category.parentId)?.name || '目录'} / ${category.name}`;
};

/**
 * 卡片右下角的“更多操作”菜单。
 * 结构对齐线上产物：cloudnav-card-action-menu / __trigger / __popover / __item。
 */
const CardActionMenu: React.FC<{ label: string; actions: CardAction[] }> = ({ label, actions }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="cloudnav-card-action-menu" ref={wrapRef} onClick={event => event.stopPropagation()}>
      <button
        type="button"
        className="cloudnav-card-action-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="cloudnav-card-action-menu__popover" role="menu" aria-label={label}>
          {actions.map(action => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              className={`cloudnav-card-action-menu__item ${action.tone === 'danger' ? 'is-danger' : ''}`}
              onClick={() => { setOpen(false); action.onSelect(); }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface CardAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  tone?: 'danger';
  disabled?: boolean;
}

/**
 * 单个书签卡片。
 * DOM 顺序对齐线上：bento-card > actions + content(title/identity/footer)。
 */
const BentoLinkCard: React.FC<{
  link: LinkItem;
  categories: Category[];
  selected: boolean;
  batchMode: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveEnabled: boolean;
  onOpen: (link: LinkItem) => void;
  onDetails: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
  onMoveLink?: (link: LinkItem, direction: 'top' | 'up' | 'down' | 'bottom') => void;
  onSaveToReadLater?: (link: LinkItem) => void;
  onTogglePin: (link: LinkItem, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
  onToggleSelection: (linkId: string) => void;
}> = ({
  link, categories, selected, batchMode, canMoveUp, canMoveDown, moveEnabled,
  onOpen, onDetails, onEdit, onDelete, onMoveLink, onSaveToReadLater,
  onTogglePin, onContextMenu, onToggleSelection,
}) => {
  const isBroken = link.health?.status === 'broken' || link.health?.statusCode === 404 || link.health?.statusCode === 410;

  const actions: CardAction[] = [
    { id: 'open', label: '打开网站', icon: <ArrowUpRight size={15} />, onSelect: () => onOpen(link) },
    { id: 'details', label: '查看详情', icon: <MoreHorizontal size={15} />, onSelect: () => onDetails(link) },
    ...(onSaveToReadLater ? [{ id: 'later', label: '加入稍后阅读', icon: <BookmarkPlus size={15} />, onSelect: () => onSaveToReadLater(link) }] : []),
    { id: 'pin', label: link.pinned ? '取消置顶' : '置顶', icon: link.pinned ? <PinOff size={15} /> : <Pin size={15} />, onSelect: () => onTogglePin(link, { preventDefault() {}, stopPropagation() {} } as React.MouseEvent) },
    { id: 'edit', label: '编辑', icon: <Edit3 size={15} />, onSelect: () => onEdit(link) },
    { id: 'delete', label: '删除', icon: <Trash2 size={15} />, tone: 'danger', onSelect: () => onDelete(link) },
    ...(onMoveLink ? [
      { id: 'move-top', label: moveEnabled ? '移到最前' : '清除搜索后排序', icon: <ChevronsUp size={15} />, disabled: !moveEnabled || !canMoveUp, onSelect: () => onMoveLink(link, 'top') },
      { id: 'move-up', label: moveEnabled ? '上移' : '清除搜索后排序', icon: <ArrowUp size={15} />, disabled: !moveEnabled || !canMoveUp, onSelect: () => onMoveLink(link, 'up') },
      { id: 'move-down', label: moveEnabled ? '下移' : '清除搜索后排序', icon: <ArrowDown size={15} />, disabled: !moveEnabled || !canMoveDown, onSelect: () => onMoveLink(link, 'down') },
      { id: 'move-bottom', label: moveEnabled ? '移到最后' : '清除搜索后排序', icon: <ChevronsDown size={15} />, disabled: !moveEnabled || !canMoveDown, onSelect: () => onMoveLink(link, 'bottom') },
    ] : []),
  ];

  return (
    <article
      className={`cloudnav-bento-card cloudnav-library-card is-clickable ${selected ? 'is-selected' : ''} ${isBroken ? 'is-broken' : ''}`}
      data-library-card={link.id}
      role="button"
      tabIndex={0}
      aria-label={`打开 ${link.title}`}
      onClick={() => onOpen(link)}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(link); } }}
      onContextMenu={event => onContextMenu(event, link)}
    >
      <div className="cloudnav-bento-card__actions">
        <CardActionMenu label={`${link.title} 更多操作`} actions={actions} />
      </div>

      <div className="cloudnav-bento-card__content">
        <h3 className="cloudnav-bento-card__title" title={link.title}>{link.title}</h3>

        <div className="cloudnav-library-card__identity">
          <div className="cloudnav-library-card__icon" aria-hidden="true">
            {link.icon ? <img src={link.icon} alt="" loading="lazy" /> : <span>{link.title.slice(0, 1)}</span>}
          </div>
          <div className="cloudnav-library-card__copy">
            <span>{link.description || '暂无描述'}</span>
            <small>{categoryPath(link.categoryId, categories)}</small>
            <span className="cloudnav-library-card__url" title={link.url}>{link.url}</span>
          </div>
        </div>

        <div className="cloudnav-library-card__footer">
          <span>{link.visitCount ? `${link.visitCount} 次访问` : '尚未访问'}</span>
          {isBroken && <span className="cloudnav-library-health">异常</span>}
          {batchMode && (
            <button
              type="button"
              className={`cloudnav-library-card__select ${selected ? 'is-selected' : ''}`}
              onClick={event => { event.stopPropagation(); onToggleSelection(link.id); }}
              aria-label={selected ? `取消选择 ${link.title}` : `选择 ${link.title}`}
            >
              {selected && <Check size={13} />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

const DesktopLibraryPage: React.FC<DesktopLibraryPageProps> = props => {
  const {
    links, pinnedLinks, displayedLinks, otherCategoryResults, categories, selectedCategory, searchQuery,
    isBatchEditMode, selectedLinks, aiConfig, onSearch, onAdd, onOpen, onDetails,
    onEdit, onDelete, onMoveLink, onSaveToReadLater, onTogglePin, onContextMenu, onToggleBatchMode, onToggleSelection, onSelectAll,
    onBatchDelete, onExitBatchMode,
  } = props;
  const [pageSummary, setPageSummary] = useState('');
  const [pageSummaryBullets, setPageSummaryBullets] = useState<string[]>([]);
  const [pageSummaryTags, setPageSummaryTags] = useState<string[]>([]);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const activeCategory = categories.find(item => item.id === selectedCategory);
  const isDefaultView = selectedCategory === 'all' && !searchQuery.trim();
  const cards = isDefaultView ? pinnedLinks : displayedLinks;

  const summarizePage = async () => {
    if (!cards.length) return;
    if (!aiConfig.apiKey && !aiConfig.hasApiKey) {
      setPageSummary('请先在设置 → AI 中配置 API Key，页面摘要会按需生成，不会自动消耗额度。');
      return;
    }
    setIsSummarizing(true);
    try {
      const { summarizeWebsiteCollection } = await import('../services/geminiService');
      const result = await summarizeWebsiteCollection({
        title: activeCategory ? activeCategory.name + ' 网站库' : 'CloudNav 置顶网站库',
        sourceTitle: 'CloudNav',
        summary: cards.slice(0, 30).map(link => link.title + '：' + (link.description || link.url)).join('\n'),
      }, aiConfig);
      setPageSummary(result.summary);
      setPageSummaryBullets(result.bullets);
      setPageSummaryTags(result.tags);
    } catch (error) {
      setPageSummary(error instanceof Error ? error.message : '页面摘要生成失败');
      setPageSummaryBullets([]);
      setPageSummaryTags([]);
    } finally {
      setIsSummarizing(false);
    }
  };

  const renderCards = (items: LinkItem[], moveEnabled = true) => items.length > 0 ? (
    <div className="cloudnav-stagger-grid-shell">
      <div className="cloudnav-stagger-grid cloudnav-library-grid">
        {items.map((link, index) => (
          <div className="cloudnav-stagger-item" key={link.id}>
            <BentoLinkCard
              link={link}
              categories={categories}
              selected={selectedLinks.has(link.id)}
              batchMode={isBatchEditMode}
              canMoveUp={index > 0}
              canMoveDown={index < items.length - 1}
              moveEnabled={moveEnabled}
              onOpen={onOpen}
              onDetails={onDetails}
              onEdit={onEdit}
              onDelete={onDelete}
              onMoveLink={onMoveLink}
              onSaveToReadLater={onSaveToReadLater}
              onTogglePin={onTogglePin}
              onContextMenu={onContextMenu}
              onToggleSelection={onToggleSelection}
            />
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="cloudnav-bento-empty-state cloudnav-library-empty">
      <Link2 size={20} />
      <strong>{isDefaultView ? '还没有置顶入口' : '当前目录没有匹配的网站'}</strong>
      <span>{isDefaultView ? '把真正每天要用的入口置顶，它们会出现在这里。' : '换一个搜索词，或从左侧目录切换。'}</span>
      {isDefaultView && <button type="button" onClick={onAdd}><Plus size={15} />添加第一个入口</button>}
    </div>
  );

  return (
    <section
      data-layout="desktop-library"
      data-layout-version="workspace-v2"
      data-library-view="bento"
      className="cloudnav-single-screen cloudnav-library-page"
    >
      <header className="cloudnav-library-header">
        <div>
          <h1>{isDefaultView ? '置顶网站' : activeCategory?.name || '网站库'}</h1>
        </div>
        <div className="cloudnav-library-header-actions">
          <button type="button" className="cloudnav-quiet-button" onClick={summarizePage} disabled={isSummarizing}><Bot size={15} />{isSummarizing ? '生成中…' : 'AI 页面摘要'}</button>
          <button type="button" className="cloudnav-primary-button" onClick={onAdd}><Plus size={16} />添加入口</button>
        </div>
      </header>

      <div className="cloudnav-single-screen__toolbar cloudnav-library-commandline">
        <label className="cloudnav-library-search"><Search size={16} /><input value={searchQuery} onChange={event => onSearch(event.target.value)} placeholder="搜索标题、网址、描述或标签" /><kbd>⌘ K</kbd>{searchQuery && <button type="button" onClick={() => onSearch('')} aria-label="清除搜索"><X size={14} /></button>}</label>
        <span className="cloudnav-library-total"><strong>{links.length}</strong> 个入口 · <strong>{pinnedLinks.length}</strong> 个置顶</span>
        {!isBatchEditMode ? <button type="button" className="cloudnav-quiet-button" onClick={onToggleBatchMode}><Check size={15} />批量选择</button> : <div className="cloudnav-batch-actions"><button type="button" onClick={onSelectAll}>全选当前</button><button type="button" onClick={onBatchDelete}><Trash2 size={14} />删除</button><button type="button" onClick={onExitBatchMode}>完成</button></div>}
      </div>

      {pageSummary && <div className="cloudnav-library-summary"><Bot size={17} /><div><strong>{pageSummary}</strong>{pageSummaryBullets.length > 0 && <ul>{pageSummaryBullets.map(item => <li key={item}>{item}</li>)}</ul>}{pageSummaryTags.length > 0 && <small>{pageSummaryTags.map(tag => '#' + tag).join('  ')}</small>}</div><button type="button" onClick={() => { setPageSummary(''); setPageSummaryBullets([]); setPageSummaryTags([]); }} aria-label="关闭页面摘要"><X size={14} /></button></div>}

      <div className="cloudnav-single-screen__body">
        <div className="cloudnav-library-workspace">
          <main className="cloudnav-library-results">
            <div className="cloudnav-library-results-head"><div><span className="cloudnav-eyebrow">{isDefaultView ? 'FAVORITES' : 'COLLECTION'}</span><h2>{isDefaultView ? '真正重要的入口' : searchQuery.trim() ? '搜索结果' : `${activeCategory?.name || '当前目录'}中的网站`}</h2></div><span>{cards.length} 条记录</span></div>
            <div className="cloudnav-library-row-list">{renderCards(cards)}</div>
            {Object.keys(otherCategoryResults).length > 0 && <section className="cloudnav-library-secondary"><div className="cloudnav-library-results-head"><div><span className="cloudnav-eyebrow">CROSS DIRECTORY</span><h2>其他目录中的匹配</h2></div><span>{Object.values(otherCategoryResults).flat().length} 条</span></div>{Object.entries(otherCategoryResults).map(([categoryId, items]) => <div key={categoryId} className="cloudnav-library-secondary-group"><h3>{categoryPath(categoryId, categories)} <span>{items.length}</span></h3>{renderCards(items, false)}</div>)}</section>}
          </main>
        </div>
      </div>
    </section>
  );
};

export default DesktopLibraryPage;

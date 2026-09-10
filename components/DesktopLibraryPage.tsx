import React, { useState } from 'react';
import {
  ArrowDown, ArrowUp, ArrowUpRight, Bot, BookmarkPlus, Check,
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

const DesktopLinkRow: React.FC<{
  link: LinkItem;
  categories: Category[];
  selected: boolean;
  batchMode: boolean;
  onOpen: (link: LinkItem) => void;
  onDetails: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onDelete: (link: LinkItem) => void;
  onMoveLink?: (link: LinkItem, direction: 'top' | 'up' | 'down' | 'bottom') => void;
  onSaveToReadLater?: (link: LinkItem) => void;
  moveEnabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onTogglePin: (link: LinkItem, event: React.MouseEvent) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
  onToggleSelection: (linkId: string) => void;
}> = ({ link, categories, selected, batchMode, onOpen, onDetails, onEdit, onDelete, onMoveLink, onSaveToReadLater, moveEnabled, canMoveUp, canMoveDown, onTogglePin, onContextMenu, onToggleSelection }) => {
  const isBroken = link.health?.status === 'broken' || link.health?.statusCode === 404 || link.health?.statusCode === 410;
  return (
    <article data-library-row={link.id} className={`cloudnav-library-row ${selected ? 'is-selected' : ''} ${isBroken ? 'is-broken' : ''}`} onContextMenu={event => onContextMenu(event, link)}>
      <div className="cloudnav-library-index" aria-hidden="true">{link.icon ? <img src={link.icon} alt="" /> : link.title.slice(0, 1)}</div>
      {batchMode && <button type="button" className={`cloudnav-library-check ${selected ? 'is-checked' : ''}`} onClick={() => onToggleSelection(link.id)} aria-label={selected ? `取消选择 ${link.title}` : `选择 ${link.title}`}>{selected && <Check size={13} />}</button>}
      <button type="button" className="cloudnav-library-primary" onClick={() => onOpen(link)}>
        <strong>{link.title}</strong>
        <span>{link.description || link.url}</span>
      </button>
      <span className="cloudnav-library-source">{categoryPath(link.categoryId, categories)}</span>
      <span className="cloudnav-library-visit">{link.visitCount ? `${link.visitCount} 次访问` : '尚未访问'}</span>
      {isBroken && <span className="cloudnav-library-health">异常</span>}
      <div className="cloudnav-library-actions">
        <button type="button" onClick={() => onMoveLink?.(link, 'top')} disabled={!moveEnabled || !canMoveUp} title={moveEnabled ? '移到最前' : '清除搜索后排序'} aria-label={'将 ' + link.title + ' 移到最前'}><ChevronsUp size={15} /></button>
        <button type="button" onClick={() => onMoveLink?.(link, 'up')} disabled={!moveEnabled || !canMoveUp} title={moveEnabled ? '上移' : '清除搜索后排序'} aria-label={'上移 ' + link.title}><ArrowUp size={15} /></button>
        <button type="button" onClick={() => onMoveLink?.(link, 'down')} disabled={!moveEnabled || !canMoveDown} title={moveEnabled ? '下移' : '清除搜索后排序'} aria-label={'下移 ' + link.title}><ArrowDown size={15} /></button>
        <button type="button" onClick={() => onMoveLink?.(link, 'bottom')} disabled={!moveEnabled || !canMoveDown} title={moveEnabled ? '移到最后' : '清除搜索后排序'} aria-label={'将 ' + link.title + ' 移到最后'}><ChevronsDown size={15} /></button>
        <button type="button" onClick={() => onDetails(link)} title="查看详情" aria-label={`查看 ${link.title} 详情`}><MoreHorizontal size={16} /></button>
        {onSaveToReadLater && <button type="button" onClick={() => onSaveToReadLater(link)} title="加入稍后阅读" aria-label={`将 ${link.title} 加入稍后阅读`}><BookmarkPlus size={15} /></button>}
        <button type="button" onClick={event => onTogglePin(link, event)} title={link.pinned ? '取消置顶' : '置顶'} aria-label={link.pinned ? `取消 ${link.title} 置顶` : `置顶 ${link.title}`}>{link.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button>
        <button type="button" onClick={() => onEdit(link)} title="编辑" aria-label={`编辑 ${link.title}`}><Edit3 size={15} /></button>
        <button type="button" onClick={() => onDelete(link)} title="删除" aria-label={`删除 ${link.title}`}><Trash2 size={15} /></button>
        <button type="button" onClick={() => onOpen(link)} title="打开网站" aria-label={`打开 ${link.title}`}><ArrowUpRight size={15} /></button>
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
  const rows = isDefaultView ? pinnedLinks : displayedLinks;

  const summarizePage = async () => {
    if (!rows.length) return;
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
        summary: rows.slice(0, 30).map(link => link.title + '：' + (link.description || link.url)).join('\n'),
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

  const renderRows = (items: LinkItem[], moveEnabled = true) => items.length > 0 ? items.map((link, index) => (
    <DesktopLinkRow key={link.id} link={link} categories={categories} selected={selectedLinks.has(link.id)} batchMode={isBatchEditMode} onOpen={onOpen} onDetails={onDetails} onEdit={onEdit} onDelete={onDelete} onMoveLink={onMoveLink} onSaveToReadLater={onSaveToReadLater} moveEnabled={moveEnabled} canMoveUp={index > 0} canMoveDown={index < items.length - 1} onTogglePin={onTogglePin} onContextMenu={onContextMenu} onToggleSelection={onToggleSelection} />
  )) : <div className="cloudnav-library-empty"><Link2 size={20} /><strong>{isDefaultView ? '还没有置顶入口' : '当前目录没有匹配的网站'}</strong><span>{isDefaultView ? '把真正每天要用的入口置顶，它们会出现在这里。' : '换一个搜索词，或从左侧目录切换。'}</span>{isDefaultView && <button type="button" onClick={onAdd}><Plus size={15} />添加第一个入口</button>}</div>;

  return (
    <section data-layout="desktop-library" data-layout-version="workspace-v2" data-library-view="rows" className="cloudnav-library-page">
      <header className="cloudnav-library-header">
        <div>
          <h1>{isDefaultView ? '置顶网站' : activeCategory?.name || '网站库'}</h1>
        </div>
        <div className="cloudnav-library-header-actions">
          <button type="button" className="cloudnav-quiet-button" onClick={summarizePage} disabled={isSummarizing}><Bot size={15} />{isSummarizing ? '生成中…' : 'AI 页面摘要'}</button>
          <button type="button" className="cloudnav-primary-button" onClick={onAdd}><Plus size={16} />添加入口</button>
        </div>
      </header>

      <div className="cloudnav-library-commandline">
        <label className="cloudnav-library-search"><Search size={16} /><input value={searchQuery} onChange={event => onSearch(event.target.value)} placeholder="搜索标题、网址、描述或标签" /><kbd>⌘ K</kbd>{searchQuery && <button type="button" onClick={() => onSearch('')} aria-label="清除搜索"><X size={14} /></button>}</label>
        <span className="cloudnav-library-total"><strong>{links.length}</strong> 个入口 · <strong>{pinnedLinks.length}</strong> 个置顶</span>
        {!isBatchEditMode ? <button type="button" className="cloudnav-quiet-button" onClick={onToggleBatchMode}><Check size={15} />批量选择</button> : <div className="cloudnav-batch-actions"><button type="button" onClick={onSelectAll}>全选当前</button><button type="button" onClick={onBatchDelete}><Trash2 size={14} />删除</button><button type="button" onClick={onExitBatchMode}>完成</button></div>}
      </div>

      {pageSummary && <div className="cloudnav-library-summary"><Bot size={17} /><div><strong>{pageSummary}</strong>{pageSummaryBullets.length > 0 && <ul>{pageSummaryBullets.map(item => <li key={item}>{item}</li>)}</ul>}{pageSummaryTags.length > 0 && <small>{pageSummaryTags.map(tag => '#' + tag).join('  ')}</small>}</div><button type="button" onClick={() => { setPageSummary(''); setPageSummaryBullets([]); setPageSummaryTags([]); }} aria-label="关闭页面摘要"><X size={14} /></button></div>}

      <div className="cloudnav-library-workspace">
        <main className="cloudnav-library-results">
          <div className="cloudnav-library-results-head"><div><span className="cloudnav-eyebrow">{isDefaultView ? 'FAVORITES' : 'COLLECTION'}</span><h2>{isDefaultView ? '真正重要的入口' : searchQuery.trim() ? '搜索结果' : `${activeCategory?.name || '当前目录'}中的网站`}</h2></div><span>{rows.length} 条记录</span></div>
          <div className="cloudnav-library-row-head"><span>入口</span><span>目录</span><span>访问</span><span>操作</span></div>
          <div className="cloudnav-library-row-list">{renderRows(rows)}</div>
          {Object.keys(otherCategoryResults).length > 0 && <section className="cloudnav-library-secondary"><div className="cloudnav-library-results-head"><div><span className="cloudnav-eyebrow">CROSS DIRECTORY</span><h2>其他目录中的匹配</h2></div><span>{Object.values(otherCategoryResults).flat().length} 条</span></div>{Object.entries(otherCategoryResults).map(([categoryId, items]) => <div key={categoryId} className="cloudnav-library-secondary-group"><h3>{categoryPath(categoryId, categories)} <span>{items.length}</span></h3>{renderRows(items, false)}</div>)}</section>}
        </main>
      </div>
    </section>
  );
};

export default DesktopLibraryPage;

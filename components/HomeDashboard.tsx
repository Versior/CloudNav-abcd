import React, { useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Check, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, ExternalLink, Eye, FileText, Folder, Inbox, Link2, NotebookPen, RotateCcw, Search,
  Settings2, Sparkles, Zap,
} from 'lucide-react';
import { Category, DashboardConfig, DashboardWidgetId, INBOX_ID, LinkItem } from '../types';
import { moveDashboardWidget } from '../services/dashboardConfig';
import WorkbenchTools from './WorkbenchTools';
import type { WorkbenchToolsState } from '../services/workbenchTools';

interface HomeDashboardProps {
  links: LinkItem[];
  categories: Category[];
  config: DashboardConfig;
  onConfigChange: (config: DashboardConfig) => void;
  onOpenInbox: () => void;
  onClickLink: (link: LinkItem) => void;
  onSelectCategory: (categoryId: string) => void;
  workbenchTools: WorkbenchToolsState;
  onWorkbenchToolsChange: (value: WorkbenchToolsState) => void;
}

const WIDGET_LABELS: Record<DashboardWidgetId, string> = { stats: '数据概览', folders: '文件夹', activity: '访问动态', tools: '效率工具' };

const timeAgo = (ts: number) => {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({
  links, categories, config, onConfigChange, onOpenInbox, onClickLink, onSelectCategory,
  workbenchTools, onWorkbenchToolsChange,
}) => {
  const [foldersCollapsed, setFoldersCollapsed] = useState(true);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [entryQuery, setEntryQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalLinks = links.filter(link => link.categoryId !== INBOX_ID && !link.deletedAt);
  const inboxLinks = links.filter(link => link.categoryId === INBOX_ID && !link.deletedAt);
  const brokenLinks = normalLinks.filter(link => link.health?.status === 'broken' || link.health?.statusCode === 404 || link.health?.statusCode === 410);
  const recentLinks = [...normalLinks].filter(link => link.lastVisitedAt).sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)).slice(0, 6);
  const freqLinks = [...normalLinks].filter(link => (link.visitCount || 0) > 0).sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 6);
  const parentCategories = categories.filter(category => !category.parentId && category.id !== INBOX_ID);
  const linkCountByCategory = normalLinks.reduce<Record<string, number>>((acc, link) => {
    acc[link.categoryId] = (acc[link.categoryId] || 0) + 1;
    return acc;
  }, {});
  const folderCards = parentCategories.map(category => {
    const childIds = categories.filter(item => item.parentId === category.id).map(item => item.id);
    const count = (linkCountByCategory[category.id] || 0) + childIds.reduce((sum, id) => sum + (linkCountByCategory[id] || 0), 0);
    return { ...category, count, childCount: childIds.length };
  });
  const categoryName = (categoryId: string) => categories.find(category => category.id === categoryId)?.name || '未分类';
  const entryLinks = useMemo(() => {
    const query = entryQuery.trim().toLowerCase();
    const candidates = [...freqLinks, ...recentLinks, ...normalLinks].filter((link, index, array) => array.findIndex(item => item.id === link.id) === index);
    if (!query) return candidates.slice(0, 6);
    return candidates.filter(link => [link.title, link.url, link.description, ...(link.tags || []), ...(link.aliases || [])].filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 6);
  }, [entryQuery, freqLinks, recentLinks, normalLinks]);

  const toggleWidget = (widget: DashboardWidgetId) => {
    const hidden = config.hidden.includes(widget) ? config.hidden.filter(id => id !== widget) : [...config.hidden, widget];
    onConfigChange({ ...config, hidden });
  };

  const Panel = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-[18px] border border-slate-200/90 bg-white/90 shadow-[0_12px_30px_rgba(31,56,102,0.055)] dark:border-slate-700 dark:bg-slate-800/90 ${className}`}>
      {children}
    </div>
  );

  const PanelHeader = ({ icon, title, meta, action }: { icon: React.ReactNode; title: string; meta?: string; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">{icon}{title}</div>
      {action || <span className="text-[11px] text-slate-400">{meta}</span>}
    </div>
  );

  const LinkRow = ({ link, meta }: { link: LinkItem; meta?: string }) => (
    <button type="button" data-spatial-id={`recent-link-${link.id}`} className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50" onClick={() => onClickLink(link)}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
        {link.icon ? <img src={link.icon} alt="" className="h-5 w-5" /> : link.title.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">{link.title}</div>
        <div className="mt-0.5 truncate text-[11px] text-slate-400">{meta || link.description || link.url}</div>
      </div>
      <ArrowUpRight size={14} className="shrink-0 text-slate-300 transition-colors group-hover:text-blue-500" />
    </button>
  );

  const EntryCard = ({ link }: { link: LinkItem }) => (
    <button type="button" onClick={() => onClickLink(link)} className="cloudnav-spatial-card group flex min-h-[104px] min-w-0 flex-col items-start rounded-[15px] border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-[0_8px_18px_rgba(31,56,102,0.035)] hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_22px_rgba(50,107,255,0.12)] dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-blue-700">
      <span className="mb-3 flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
        {link.icon ? <img src={link.icon} alt="" className="h-5 w-5" /> : <Sparkles size={15} />}
      </span>
      <strong className="w-full truncate text-[11px] font-bold text-slate-700 dark:text-slate-100">{link.title}</strong>
      <span className="mt-1 w-full truncate text-[10px] text-slate-400">{categoryName(link.categoryId)}</span>
    </button>
  );

  const renderWidget = (widget: DashboardWidgetId) => {
    if (config.hidden.includes(widget)) return null;
    if (widget === 'stats') return null;

    if (widget === 'folders') return folderCards.length > 0 ? (
      <section key={widget} data-dashboard-widget={widget} data-dashboard-zone="entries" className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100"><Folder size={15} className="text-amber-500" />我的分类</h2><p className="mt-1 text-[11px] text-slate-400">按分类快速跳转，不把所有链接堆在首页。</p></div>
          <button type="button" onClick={() => setFoldersCollapsed(value => !value)} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-300">{foldersCollapsed ? '展开分类' : '收起'} {foldersCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(foldersCollapsed ? folderCards.slice(0, 5) : folderCards).map(folder => <button type="button" key={folder.id} onClick={() => onSelectCategory(folder.id)} className="flex min-w-[142px] items-center gap-2 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2.5 text-left text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50/70 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"><Folder size={15} className="shrink-0 text-slate-400" /><span className="truncate">{folder.name}</span><span className="ml-auto text-[10px] font-normal text-slate-400">{folder.count}</span></button>)}
        </div>
      </section>
    ) : null;

    if (widget === 'tools') return (
      <section key={widget} data-dashboard-widget={widget} data-dashboard-zone="tools" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100"><NotebookPen size={15} className="text-violet-500" />工作台工具</h2><p className="mt-1 text-[11px] text-slate-400">待办、笔记和天气，保持在手边但不抢入口。</p></div></div>
        <WorkbenchTools value={workbenchTools} onChange={onWorkbenchToolsChange} />
      </section>
    );

    return (
      <section key={widget} data-dashboard-widget={widget} data-dashboard-zone="recent" className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.75fr)]">
        <Panel>
          <PanelHeader icon={<Clock3 size={15} className="text-blue-500" />} title="最近访问" meta="按时间排序" />
          <div className="space-y-0.5 px-2 pb-2">{recentLinks.length > 0 ? recentLinks.map(link => <LinkRow key={link.id} link={link} meta={link.lastVisitedAt ? `${timeAgo(link.lastVisitedAt)} · ${categoryName(link.categoryId)}` : categoryName(link.categoryId)} />) : <p className="px-3 py-10 text-center text-xs text-slate-400">还没有访问记录，点开几个网站后这里会变聪明。</p>}</div>
        </Panel>
        <Panel className="h-fit" data-dashboard-zone="focus">
          <PanelHeader icon={<Sparkles size={15} className="text-violet-500" />} title="今日专注" meta="保持轻量" />
          <div className="grid gap-2.5 px-4 pb-4">
            {inboxLinks.length > 0 ? <button type="button" onClick={onOpenInbox} className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-left transition-colors hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"><CheckCircle2 size={17} className="shrink-0 text-amber-500" /><span><strong className="block text-xs font-bold text-slate-700 dark:text-slate-200">整理待处理链接</strong><small className="mt-1 block text-[10px] text-slate-400">{inboxLinks.length} 个入口等待归档</small></span></button> : <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20"><CheckCircle2 size={17} className="shrink-0 text-emerald-500" /><span><strong className="block text-xs font-bold text-slate-700 dark:text-slate-200">收件箱已清空</strong><small className="mt-1 block text-[10px] text-slate-400">今天的工作台很整洁</small></span></div>}
            <button type="button" onClick={() => folderCards[0] && onSelectCategory(folderCards[0].id)} className="flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-left transition-colors hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"><Folder size={17} className="shrink-0 text-blue-500" /><span><strong className="block text-xs font-bold text-slate-700 dark:text-slate-200">进入常用分类</strong><small className="mt-1 block text-[10px] text-slate-400">{folderCards[0]?.name || '还没有分类'}</small></span></button>
            <div className="flex items-center gap-3 rounded-xl bg-violet-50 p-3 dark:bg-violet-950/20"><FileText size={17} className="shrink-0 text-violet-500" /><span><strong className="block text-xs font-bold text-slate-700 dark:text-slate-200">快捷笔记</strong><small className="mt-1 block truncate text-[10px] text-slate-400">{workbenchTools.note ? '今天已经写下内容' : '在下方工具区记录想法'}</small></span></div>
          </div>
        </Panel>
      </section>
    );
  };

  const currentTime = new Date();

  return (
    <section data-dashboard-layout="command-center" data-spatial-id="dashboard" className="min-h-full bg-transparent pb-3">
      <section data-dashboard-zone="hero" className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1b2a55] via-[#2d61d7] to-[#597cff] px-5 py-6 text-white shadow-[0_18px_38px_rgba(36,66,143,0.2)] sm:px-7">
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-72 rotate-[-20deg] rounded-[50%] border border-white/20" />
        <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div><div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-blue-100">KAI NAV · COMMAND CENTER</div><h1 className="text-[27px] font-bold leading-tight tracking-[-0.05em] text-white">今天，先从重要的开始。</h1><p className="mt-2 text-xs text-blue-100">你的常用入口、最近动作和待处理事项都在这里。</p></div>
          <div className="flex items-center gap-2 text-blue-100"><Clock3 size={14} /><strong className="text-lg text-white">{currentTime.toLocaleTimeString('zh-CN', { hour12: false })}</strong><span className="text-[11px]">{currentTime.toLocaleDateString('zh-CN')}</span></div>
        </div>
        <div className="relative z-10 mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/25 bg-[#081949]/20 px-3 py-2.5 text-xs text-blue-100 sm:max-w-[520px]"><Sparkles size={14} className="shrink-0" /><input ref={searchInputRef} value={entryQuery} onChange={event => setEntryQuery(event.target.value)} placeholder="输入关键词，快速定位一个网站" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-blue-100/70" /><span className="hidden text-[10px] text-blue-100/60 sm:inline">⌘ K</span></div>
          <button type="button" onClick={() => searchInputRef.current?.focus()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20"><Search size={13} />快速定位</button>
          <button type="button" aria-label="自定义模块" onClick={() => setIsCustomizing(value => !value)} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-[11px] font-bold text-white transition-colors hover:bg-white/20"><Settings2 size={13} />整理工作台</button>
        </div>
        {!config.hidden.includes('stats') && <div data-dashboard-widget="stats" data-dashboard-zone="metrics" className="relative z-10 mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">{[{ icon: <Link2 size={16} />, label: '总链接', value: normalLinks.length }, { icon: <Eye size={16} />, label: '已访问', value: normalLinks.filter(link => (link.visitCount || 0) > 0).length }, { icon: <AlertTriangle size={16} />, label: '异常链接', value: brokenLinks.length }].map(item => <div key={item.label} className="flex items-center gap-2.5 rounded-[14px] border border-white/20 bg-white/10 px-3.5 py-3"><span className="text-blue-100">{item.icon}</span><span><strong className="block text-xl leading-none text-white">{item.value}</strong><small className="mt-1 block text-[10px] text-blue-100">{item.label}</small></span></div>)}</div>}
      </section>

      {isCustomizing && <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-800 dark:bg-blue-900/20"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold text-slate-800 dark:text-white">显示哪些模块</h2><p className="mt-1 text-xs text-slate-500">拖动逻辑用上下箭头完成，设置会自动保存。</p></div><button type="button" onClick={() => onConfigChange({ order: ['stats', 'folders', 'activity', 'tools'], hidden: [] })} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600"><RotateCcw size={13} />恢复默认</button></div><div className="flex flex-wrap gap-2">{config.order.map((widget, index) => { const hidden = config.hidden.includes(widget); return <div key={widget} className={`inline-flex items-center gap-1 rounded-xl border px-2 py-1.5 ${hidden ? 'border-slate-200 bg-white/60 opacity-60 dark:border-slate-700 dark:bg-slate-800' : 'border-blue-200 bg-white dark:border-blue-800 dark:bg-slate-800/70'}`}><button type="button" onClick={() => toggleWidget(widget)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"><span className={`flex h-4 w-4 items-center justify-center rounded-md border ${hidden ? 'border-slate-300 dark:border-slate-600' : 'border-blue-500 bg-blue-500 text-white'}`}>{!hidden && <Check size={11} />}</span>{WIDGET_LABELS[widget]}</button><button type="button" aria-label={`上移${WIDGET_LABELS[widget]}`} disabled={index === 0} onClick={() => onConfigChange(moveDashboardWidget(config, widget, -1))} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={14} /></button><button type="button" aria-label={`下移${WIDGET_LABELS[widget]}`} disabled={index === config.order.length - 1} onClick={() => onConfigChange(moveDashboardWidget(config, widget, 1))} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={14} /></button></div>; })}</div></div>}

      {config.order.map(renderWidget)}

      <section data-dashboard-zone="entries" className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100"><Zap size={15} className="text-blue-500" />我的入口</h2><p className="mt-1 text-[11px] text-slate-400">只展示最常用的几个入口，更多内容留在置顶网站页面。</p></div><span className="text-[11px] text-slate-400">{entryLinks.length} 个快捷入口</span></div>
        {entryLinks.length > 0 ? <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">{entryLinks.map(link => <EntryCard key={link.id} link={link} />)}</div> : <Panel className="p-8 text-center text-xs text-slate-400">没有匹配的入口，换个关键词试试。</Panel>}
      </section>

      <div className="sr-only"><Activity aria-hidden="true" /><BarChart3 aria-hidden="true" /><Inbox aria-hidden="true" /><ExternalLink aria-hidden="true" /></div>
    </section>
  );
};

export default HomeDashboard;

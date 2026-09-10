import React, { useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, Check, ChevronDown, ChevronUp,
  Clock3, Eye, Folder, Inbox, Link2, RotateCcw,
  Search, Settings2, Sparkles, Zap,
} from 'lucide-react';
import { INBOX_ID } from '../types';
import type { AIConfig, Category, DashboardConfig, DashboardWidgetId, LinkItem } from '../types';
import { moveDashboardWidget } from '../services/dashboardConfig';
import { getInboxLinks, getNormalLinks } from '../services/workbenchSelectors';
import FloatingTodo from './FloatingTodo';
import type { WorkbenchToolsState } from '../services/workbenchTools';

export interface HomeDashboardProps {
  links: LinkItem[];
  categories: Category[];
  config: DashboardConfig;
  onConfigChange: (config: DashboardConfig) => void;
  onOpenInbox: () => void;
  onClickLink: (link: LinkItem) => void;
  onSelectCategory: (categoryId: string) => void;
  workbenchTools: WorkbenchToolsState;
  onWorkbenchToolsChange: (value: WorkbenchToolsState) => void;
  aiConfig?: AIConfig;
}

const WIDGET_LABELS: Record<DashboardWidgetId, string> = { stats: '数据概览', folders: '文件夹', activity: '访问动态', tools: '待办事项' };
// 顶部天气由全局 TopWeather 提供，工作台工具区只承载待办。
const timeAgo = (ts: number) => {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};

const HomeDashboard: React.FC<HomeDashboardProps> = ({
  links, categories, config, onConfigChange, onOpenInbox, onClickLink, onSelectCategory,
  workbenchTools, onWorkbenchToolsChange, aiConfig,
}) => {
  const [entryQuery, setEntryQuery] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [foldersCollapsed, setFoldersCollapsed] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const normalLinks = useMemo(() => getNormalLinks(links), [links]);
  const inboxLinks = useMemo(() => getInboxLinks(links), [links]);
  const brokenLinks = useMemo(() => normalLinks.filter(link => link.health?.status === 'broken' || link.health?.statusCode === 404 || link.health?.statusCode === 410), [normalLinks]);
  const recentLinks = useMemo(() => [...normalLinks].filter(link => link.lastVisitedAt).sort((a, b) => (b.lastVisitedAt || 0) - (a.lastVisitedAt || 0)).slice(0, 10), [normalLinks]);
  const frequentLinks = useMemo(() => [...normalLinks].sort((a, b) => (b.visitCount || 0) - (a.visitCount || 0)).slice(0, 8), [normalLinks]);
  const parentCategories = useMemo(() => categories.filter(category => !category.parentId && category.id !== INBOX_ID), [categories]);
  const categoryName = (id: string) => categories.find(category => category.id === id)?.name || '未分类';
  const categoryCounts = useMemo(() => normalLinks.reduce<Record<string, number>>((acc, link) => { acc[link.categoryId] = (acc[link.categoryId] || 0) + 1; return acc; }, {}), [normalLinks]);
  const searchedLinks = useMemo(() => {
    const query = entryQuery.trim().toLowerCase();
    const candidates = [...recentLinks, ...frequentLinks, ...normalLinks].filter((link, index, list) => list.findIndex(item => item.id === link.id) === index);
    return (query ? candidates.filter(link => [link.title, link.url, link.description, ...(link.tags || [])].filter(Boolean).join(' ').toLowerCase().includes(query)) : candidates).slice(0, 8);
  }, [entryQuery, frequentLinks, normalLinks, recentLinks]);

  const generateBrief = async () => {
    if (!aiConfig?.apiKey && !aiConfig?.hasApiKey) { setAiBrief('请先在设置 → AI 中配置 API Key，工作台简报会按需生成。'); return; }
    setAiLoading(true);
    try {
      const { summarizeWorkbench } = await import('../services/geminiService');
      const result = await summarizeWorkbench({ title: 'CloudNav 工作台简报', sourceTitle: 'CloudNav', summary: normalLinks.length + ' 个链接，' + recentLinks.length + ' 个最近访问，' + inboxLinks.length + ' 个待整理，' + brokenLinks.length + ' 个异常。最近入口：' + recentLinks.map(link => link.title).join('、') }, aiConfig);
      setAiBrief(result.summary + (result.bullets.length ? ` ${result.bullets.join('；')}` : ''));
    } catch (error) { setAiBrief(error instanceof Error ? error.message : 'AI 简报生成失败'); }
    finally { setAiLoading(false); }
  };

  const toggleWidget = (widget: DashboardWidgetId) => {
    const hidden = config.hidden.includes(widget) ? config.hidden.filter(id => id !== widget) : [...config.hidden, widget];
    onConfigChange({ ...config, hidden });
  };

  const renderWidget = (widget: DashboardWidgetId): React.ReactNode => {
    if (config.hidden.includes(widget)) return null;
    if (widget === 'stats') return <section data-dashboard-widget="stats" className="cloudnav-workbench-stats"><div><Link2 size={17} /><strong>{normalLinks.length}</strong><span>总链接</span></div><div><Eye size={17} /><strong>{normalLinks.filter(link => (link.visitCount || 0) > 0).length}</strong><span>已访问</span></div><div className={brokenLinks.length ? 'is-warning' : ''}><AlertTriangle size={17} /><strong>{brokenLinks.length}</strong><span>异常链接</span></div><div><Inbox size={17} /><strong>{inboxLinks.length}</strong><span>待整理</span></div></section>;
    if (widget === 'folders') return <section data-dashboard-widget="folders" className="cloudnav-workbench-folders" data-dashboard-zone="folders"><div className="cloudnav-section-head"><div><span className="cloudnav-eyebrow">DIRECTORIES</span><h2>分类目录</h2></div><button type="button" className="cloudnav-text-button" onClick={() => setFoldersCollapsed(value => !value)}>{foldersCollapsed ? '展开全部' : '收起'} {foldersCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div><div className="cloudnav-workbench-directory-list">{(foldersCollapsed ? parentCategories.slice(0, 8) : parentCategories).map(category => <button type="button" key={category.id} onClick={() => onSelectCategory(category.id)}><Folder size={15} /><span>{category.name}</span><em>{categoryCounts[category.id] || 0}</em></button>)}</div></section>;
    if (widget === 'tools') return <section data-dashboard-widget="tools" data-dashboard-zone="tools"><FloatingTodo value={workbenchTools} onChange={onWorkbenchToolsChange} /></section>;
    return <div data-dashboard-widget="activity" className="cloudnav-workbench-main"><section className="cloudnav-workbench-activity" data-dashboard-zone="activity"><div className="cloudnav-section-head"><div><span className="cloudnav-eyebrow">ACTIVITY STREAM</span><h2>最近访问</h2></div><span>{recentLinks.length} 条</span></div>{recentLinks.length ? <div className="cloudnav-workbench-timeline">{recentLinks.map(link => <button type="button" key={link.id} className="cloudnav-workbench-timeline-row" onClick={() => onClickLink(link)}><span className="cloudnav-workbench-timeline-dot" /><span className="cloudnav-workbench-timeline-time">{link.lastVisitedAt ? timeAgo(link.lastVisitedAt) : '刚刚'}</span><span className="cloudnav-workbench-timeline-title"><strong>{link.title}</strong><small>{categoryName(link.categoryId)} · {link.description || link.url}</small></span><ArrowUpRight size={15} /></button>)}</div> : <div className="cloudnav-workbench-empty"><Clock3 size={20} /><span>还没有访问记录，打开几个入口后这里会形成时间线。</span></div>}</section><aside className="cloudnav-workbench-side"><section className="cloudnav-focus-panel"><div className="cloudnav-section-head"><div><span className="cloudnav-eyebrow">FOCUS</span><h2>今天处理</h2></div><Sparkles size={16} /></div>{inboxLinks.length ? <button type="button" className="cloudnav-focus-action is-amber" onClick={onOpenInbox}><Inbox size={17} /><span><strong>整理待处理入口</strong><small>{inboxLinks.length} 个等待归档</small></span></button> : <div className="cloudnav-focus-action is-green"><Check size={17} /><span><strong>收件箱已清空</strong><small>今天的入口很整洁</small></span></div>}<button type="button" className="cloudnav-focus-action is-blue" onClick={() => parentCategories[0] && onSelectCategory(parentCategories[0].id)}><Folder size={17} /><span><strong>进入常用分类</strong><small>{parentCategories[0]?.name || '还没有分类'}</small></span></button></section><section className="cloudnav-workbench-rank"><div className="cloudnav-section-head"><div><span className="cloudnav-eyebrow">FREQUENT</span><h2>高频入口</h2></div><span>按访问量</span></div>{frequentLinks.slice(0, 5).map((link, index) => <button type="button" key={link.id} onClick={() => onClickLink(link)}><b>{String(index + 1).padStart(2, '0')}</b><span>{link.title}</span><em>{link.visitCount || 0}</em></button>)}</section></aside></div>;
  };

  return <section data-workbench-layout="desktop-command-surface" data-layout-version="workbench-v2" data-dashboard-layout="command-center" data-spatial-id="dashboard" className="cloudnav-workbench">
    <header className="cloudnav-workbench-header"><div><div className="cloudnav-eyebrow"><Zap size={14} /> PERSONAL OPERATIONS DESK</div><h1>工作台</h1><p>只放今天真正要处理的事情。置顶入口和完整网站库保持分离。</p></div><div className="cloudnav-workbench-header-actions"><button type="button" className="cloudnav-quiet-button" onClick={() => searchRef.current?.focus()}><Search size={15} />快速定位</button><button type="button" className="cloudnav-quiet-button" onClick={() => setIsCustomizing(value => !value)}><Settings2 size={15} />整理模块</button></div></header>
    <div className="cloudnav-workbench-command"><label><Search size={16} /><input ref={searchRef} value={entryQuery} onChange={event => setEntryQuery(event.target.value)} placeholder="输入关键词，定位最近入口" /><kbd>⌘ K</kbd></label><button type="button" className="cloudnav-primary-button" onClick={generateBrief} disabled={aiLoading}><Bot size={15} />{aiLoading ? '整理中…' : '生成今日 AI 简报'}</button></div>
    {aiBrief && <div className="cloudnav-workbench-brief" data-dashboard-zone="ai"><Bot size={17} /><div><strong>今日 AI 简报</strong><p>{aiBrief}</p></div><button type="button" onClick={() => setAiBrief('')} aria-label="关闭 AI 简报">×</button></div>}
    {isCustomizing && <section className="cloudnav-workbench-customizer"><div><strong>工作台模块</strong><span>隐藏或调整模块顺序，设置会自动保存。</span></div><div className="cloudnav-workbench-customizer-items">{config.order.map((widget, index) => { const hidden = config.hidden.includes(widget); return <span key={widget} className={hidden ? 'is-hidden' : ''}><button type="button" onClick={() => toggleWidget(widget)}><i>{!hidden && <Check size={11} />}</i>{WIDGET_LABELS[widget]}</button><button type="button" disabled={index === 0} onClick={() => onConfigChange(moveDashboardWidget(config, widget, -1))}><ChevronUp size={13} /></button><button type="button" disabled={index === config.order.length - 1} onClick={() => onConfigChange(moveDashboardWidget(config, widget, 1))}><ChevronDown size={13} /></button></span>; })}<button type="button" className="cloudnav-text-button" onClick={() => onConfigChange({ order: ['stats', 'folders', 'activity', 'tools'], hidden: [] })}><RotateCcw size={13} />恢复默认</button></div></section>}
    <div className="cloudnav-workbench-widgets">{config.order.map(widget => <React.Fragment key={widget}>{renderWidget(widget)}</React.Fragment>)}</div>
    <section className="cloudnav-workbench-search-results" data-dashboard-zone="search-results"><div className="cloudnav-section-head"><div><span className="cloudnav-eyebrow">QUICK ACCESS</span><h2>{entryQuery ? '定位结果' : '常用入口'}</h2></div><span>{searchedLinks.length} 条</span></div><div className="cloudnav-workbench-entry-list">{searchedLinks.map(link => <button type="button" key={link.id} onClick={() => onClickLink(link)}><span>{link.icon ? <img src={link.icon} alt="" /> : link.title.slice(0, 1)}</span><strong>{link.title}</strong><small>{categoryName(link.categoryId)}</small><ArrowUpRight size={14} /></button>)}</div></section>
    <div className="sr-only"><Activity aria-hidden="true" /></div>
  </section>;
};

export default HomeDashboard;

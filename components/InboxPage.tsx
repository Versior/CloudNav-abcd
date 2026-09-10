import React, { useMemo, useState } from 'react';
import { Archive, Check, ExternalLink, Inbox, Search, Sparkles, Star } from 'lucide-react';
import type { LinkItem, RssArticle, UnifiedInboxItem } from '../types';
import { GITHUB_WATCH_KEY, INSPIRATIONS_KEY, READ_LATER_KEY } from '../constants/storageKeys';
import { normalizeGithubWatch } from '../services/githubService';
import { normalizeInspirations } from '../services/inspirationService';
import { buildInboxItems, getInboxKindLabel } from '../services/inboxService';
import { normalizeReadLater, updateReadLaterStatus } from '../services/readLaterService';
import { normalizeRssState, readRssState, writeRssState } from '../services/rssService';
import { readWorkspaceList, WORKSPACE_DATA_CHANGED_EVENT, writeWorkspaceList } from '../services/workspaceStorage';

interface InboxPageProps {
  links: LinkItem[];
  onOpenUrl?: (url: string) => void;
  onCaptureRss?: (article: RssArticle) => void;
  onMarkLinkDone?: (linkId: string) => void;
}

const getSourceData = (links: LinkItem[]) => buildInboxItems({
  links,
  articles: readRssState().articles,
  readLater: readWorkspaceList(READ_LATER_KEY, normalizeReadLater),
  inspirations: readWorkspaceList(INSPIRATIONS_KEY, normalizeInspirations),
  githubWatch: readWorkspaceList(GITHUB_WATCH_KEY, normalizeGithubWatch),
});

const InboxPage: React.FC<InboxPageProps> = ({ links, onOpenUrl, onCaptureRss, onMarkLinkDone }) => {
  const [items, setItems] = useState<UnifiedInboxItem[]>(() => getSourceData(links));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const reload = () => setItems(getSourceData(links));

  React.useEffect(() => {
    const handler = () => reload();
    window.addEventListener(WORKSPACE_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_DATA_CHANGED_EVENT, handler);
  }, [links]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return items.filter(item => {
      if (filter === 'unread' && item.read) return false;
      if (filter === 'starred' && !item.starred) return false;
      if (!normalized) return true;
      return [item.title, item.summary, item.source].filter(Boolean).join(' ').toLocaleLowerCase().includes(normalized);
    });
  }, [filter, items, query]);

  const markDone = (item: UnifiedInboxItem) => {
    if (item.kind === 'rss') {
      const state = readRssState();
      const articleId = item.id.slice(4);
      writeRssState(normalizeRssState({ ...state, articles: state.articles.map(article => article.id === articleId ? { ...article, read: true, starred: false } : article) }));
    } else if (item.kind === 'read-later') {
      const id = item.id.slice('read-later:'.length);
      writeWorkspaceList(READ_LATER_KEY, updateReadLaterStatus(readWorkspaceList(READ_LATER_KEY, normalizeReadLater), id, 'archived'), normalizeReadLater);
    } else if (item.kind === 'inspiration') {
      const id = item.id.slice('inspiration:'.length);
      const current = readWorkspaceList(INSPIRATIONS_KEY, normalizeInspirations);
      writeWorkspaceList(INSPIRATIONS_KEY, current.map(idea => idea.id === id ? { ...idea, status: 'archived', archivedAt: Date.now(), updatedAt: Date.now() } : idea), normalizeInspirations);
    } else if (item.kind === 'github') {
      const id = item.id.slice('github:'.length);
      const current = readWorkspaceList(GITHUB_WATCH_KEY, normalizeGithubWatch);
      writeWorkspaceList(GITHUB_WATCH_KEY, current.map(repo => repo.id === id ? { ...repo, processedAt: Date.now() } : repo), normalizeGithubWatch);
    } else if (item.kind === 'website') {
      onMarkLinkDone?.(item.id.slice('website:'.length));
    }
    setItems(current => current.filter(currentItem => currentItem.id !== item.id));
  };

  const capture = (item: UnifiedInboxItem) => {
    if (item.kind !== 'rss' || !onCaptureRss) return;
    const article = readRssState().articles.find(candidate => `rss:${candidate.id}` === item.id);
    if (article) onCaptureRss(article);
  };

  return <section data-page="inbox" className="cloudnav-workspace-page cloudnav-inbox-page">
    <header className="cloudnav-page-header"><div><div className="cloudnav-eyebrow"><Inbox size={14} /> UNIFIED INBOX</div><h1>统一收件箱</h1><p>把资讯、稍后阅读、灵感与项目更新汇成一条可处理的信息流。</p></div><div className="cloudnav-reading-stat"><strong>{items.filter(item => !item.read).length}</strong><span>待处理</span></div></header>
    <div className="cloudnav-workspace-toolbar"><label className="cloudnav-search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索所有内容" /></label><div className="cloudnav-segmented"><button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>全部</button><button className={filter === 'unread' ? 'is-active' : ''} onClick={() => setFilter('unread')}>待处理</button><button className={filter === 'starred' ? 'is-active' : ''} onClick={() => setFilter('starred')}>重点</button></div></div>
    <div className="cloudnav-inbox-stream">{visible.length === 0 ? <div className="cloudnav-empty-state"><Inbox size={30} /><strong>收件箱是空的</strong><span>新 RSS、灵感和稍后阅读内容会自动出现在这里。</span></div> : visible.map(item => <article key={item.id} className={`cloudnav-inbox-item ${item.read ? 'is-read' : ''}`}><div className="cloudnav-inbox-kind">{getInboxKindLabel(item.kind)}</div><div className="min-w-0 flex-1"><h2>{item.title}</h2><p>{item.summary || '暂无摘要，打开来源查看完整内容。'}</p><small>{item.source || 'CloudNav'} · {item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '时间未知'}</small></div><div className="cloudnav-inbox-actions">{item.url && <button title="打开来源" onClick={() => onOpenUrl?.(item.url!)}><ExternalLink size={16} /></button>}{item.kind === 'rss' && onCaptureRss && <button title="记入灵感" onClick={() => capture(item)}><Sparkles size={16} /></button>}<button title="标记处理" onClick={() => markDone(item)}>{item.read ? <Archive size={16} /> : <Check size={16} />}</button>{item.starred && <Star size={15} className="is-starred" />}</div></article>)}</div>
  </section>;
};

export default InboxPage;

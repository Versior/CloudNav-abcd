import React, { useMemo, useState } from 'react';
import { Archive, Check, ExternalLink, Inbox, RotateCcw, Search, Sparkles } from 'lucide-react';
import type { ReadLaterItem, ReadLaterStatus } from '../types';
import { READ_LATER_KEY } from '../constants/storageKeys';
import { normalizeReadLater, updateReadLaterStatus } from '../services/readLaterService';
import { readWorkspaceList, WORKSPACE_DATA_CHANGED_EVENT, writeWorkspaceList } from '../services/workspaceStorage';

interface ReadLaterPageProps { initialId?: string; onInitialIdConsumed?: () => void; onOpenUrl?: (url: string) => void; onNotice?: (message: string) => void; }

const ReadLaterPage: React.FC<ReadLaterPageProps> = ({ initialId, onInitialIdConsumed, onOpenUrl, onNotice }) => {
  const [items, setItems] = useState<ReadLaterItem[]>(() => readWorkspaceList(READ_LATER_KEY, normalizeReadLater));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<ReadLaterStatus>('unread');
  const [query, setQuery] = useState('');
  React.useEffect(() => {
    const reload = () => setItems(readWorkspaceList(READ_LATER_KEY, normalizeReadLater));
    window.addEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
  }, []);
  React.useEffect(() => {
    if (!initialId || !items.some(item => item.id === initialId)) return;
    const target = items.find(item => item.id === initialId);
    if (!target) return;
    setStatus(target.status);
    setQuery('');
    setSelectedId(target.id);
    onInitialIdConsumed?.();
  }, [initialId, items, onInitialIdConsumed]);
  const persist = (next: ReadLaterItem[]) => setItems(writeWorkspaceList(READ_LATER_KEY, next, normalizeReadLater));
  const visible = useMemo(() => items.filter(item => item.status === status && `${item.title} ${item.source || ''} ${item.summary || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [items, query, status]);
  const updateStatus = (item: ReadLaterItem, next: ReadLaterStatus) => { if (item.status === next) return; persist(updateReadLaterStatus(items, item.id, next)); onNotice?.(next === 'read' ? '已标记为已读' : next === 'archived' ? '已归档' : '已恢复'); };

  return <section data-page="read-later" className="cloudnav-workspace-page"><header className="cloudnav-page-header"><div><div className="cloudnav-eyebrow"><Inbox size={14} /> READING QUEUE</div><h1>稍后阅读</h1><p>来自 RSS、网站库和 GitHub 的内容，都在这里排队。</p></div><div className="cloudnav-reading-stat"><strong>{items.filter(item => item.status === 'unread').length}</strong><span>未读</span></div></header><div className="cloudnav-workspace-toolbar"><div className="cloudnav-search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索稍后阅读" /></div><div className="cloudnav-segmented"><button className={status === 'unread' ? 'is-active' : ''} onClick={() => setStatus('unread')}>未读</button><button className={status === 'read' ? 'is-active' : ''} onClick={() => setStatus('read')}>已读</button><button className={status === 'archived' ? 'is-active' : ''} onClick={() => setStatus('archived')}>归档</button></div></div><div className="cloudnav-reading-list">{visible.length === 0 ? <div className="cloudnav-empty-state"><Archive size={30} /><strong>这里还没有内容</strong><span>在 RSS 文章或网站详情中点击“稍后阅读”即可加入。</span></div> : visible.map(item => <article key={item.id} data-read-later-selected={selectedId === item.id ? 'true' : undefined} className={`cloudnav-reading-item ${selectedId === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}><div className="cloudnav-reading-kind">{item.kind === 'rss' ? 'RSS' : item.kind === 'github' ? 'GITHUB' : item.kind === 'website' ? '网站' : '灵感'}</div><div className="min-w-0 flex-1"><h2>{item.title}</h2><p>{item.summary || '暂无摘要，打开原文查看完整内容。'}</p><small>{item.source || item.url}</small></div><div className="cloudnav-reading-actions"><button title="打开原文" onClick={() => { onOpenUrl?.(item.url); if (item.status === 'unread') updateStatus(item, 'read'); }}><ExternalLink size={16} /></button>{item.status === 'unread' && <button title="标记已读" onClick={() => updateStatus(item, 'read')}><Check size={16} /></button>}{item.status === 'read' && <button title="恢复未读" onClick={() => updateStatus(item, 'unread')}><RotateCcw size={16} /></button>}<button title="归档" onClick={() => updateStatus(item, 'archived')}><Archive size={16} /></button></div></article>)}</div><div className="cloudnav-inline-tip"><Sparkles size={15} /> 文章摘要优先显示原始 RSS 内容，AI 只在你主动点击时生成。</div></section>;
};

export default ReadLaterPage;

import React, { useMemo, useState } from 'react';
import { ExternalLink, Github, Plus, RefreshCw, Search, Star, Trash2 } from 'lucide-react';
import type { GithubWatchItem } from '../types';
import { GITHUB_WATCH_KEY } from '../constants/storageKeys';
import { fetchGithubRepository, normalizeGithubWatch, normalizeGithubWatchItem, parseGithubRepositoryUrl } from '../services/githubService';
import { readWorkspaceList, WORKSPACE_DATA_CHANGED_EVENT, writeWorkspaceList } from '../services/workspaceStorage';

interface GithubPageProps { initialId?: string; onInitialIdConsumed?: () => void; onOpenUrl?: (url: string) => void; onNotice?: (message: string) => void; }

const GithubPage: React.FC<GithubPageProps> = ({ initialId, onInitialIdConsumed, onOpenUrl, onNotice }) => {
  const [items, setItems] = useState<GithubWatchItem[]>(() => readWorkspaceList(GITHUB_WATCH_KEY, normalizeGithubWatch));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  React.useEffect(() => {
    const reload = () => setItems(readWorkspaceList(GITHUB_WATCH_KEY, normalizeGithubWatch));
    window.addEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(WORKSPACE_DATA_CHANGED_EVENT, reload);
  }, []);
  React.useEffect(() => {
    if (!initialId || !items.some(item => item.id === initialId)) return;
    setQuery('');
    setSelectedId(initialId);
    onInitialIdConsumed?.();
  }, [initialId, items, onInitialIdConsumed]);
  const persist = (next: GithubWatchItem[]) => setItems(writeWorkspaceList(GITHUB_WATCH_KEY, next, normalizeGithubWatch));
  const updateItem = (id: string, update: (item: GithubWatchItem) => GithubWatchItem) => {
    setItems(current => writeWorkspaceList(GITHUB_WATCH_KEY, current.map(item => item.id === id ? update(item) : item), normalizeGithubWatch));
  };
  const visible = useMemo(() => items.filter(item => `${item.owner}/${item.repo} ${item.description || ''} ${item.language || ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [items, query]);
  const add = async (event: React.FormEvent) => { event.preventDefault(); const parsed = parseGithubRepositoryUrl(repoUrl.trim()); if (!parsed) { onNotice?.('请输入有效的 GitHub 仓库地址'); return; } const next = normalizeGithubWatchItem({ ...parsed }, Date.now()); if (items.some(item => item.url === next.url)) { onNotice?.('这个仓库已经在追踪列表中'); return; } const nextItems = [next, ...items]; persist(nextItems); setRepoUrl(''); await refresh(next); };
  const refresh = async (item: GithubWatchItem) => { setBusyId(item.id); try { const data = await fetchGithubRepository(item.owner, item.repo); updateItem(item.id, current => normalizeGithubWatchItem({ ...current, description: data.description || current.description, stars: data.stars, language: data.language || current.language, lastRelease: data.pushedAt || current.lastRelease, error: '' })); onNotice?.('GitHub 仓库信息已刷新'); } catch (error) { const message = error instanceof Error ? error.message : 'GitHub 刷新失败'; updateItem(item.id, current => ({ ...current, error: message, lastFetchedAt: Date.now() })); onNotice?.(message); } finally { setBusyId(null); } };
  const remove = (item: GithubWatchItem) => persist(items.filter(current => current.id !== item.id));
  return <section data-page="github" className="cloudnav-workspace-page"><header className="cloudnav-page-header"><div><div className="cloudnav-eyebrow"><Github size={14} /> PROJECT RADAR</div><h1>GitHub 追踪</h1><p>关注仓库的描述、活跃度和更新，不再依赖没有数据的热门项目卡片。</p></div><form onSubmit={add} className="cloudnav-github-add"><input value={repoUrl} onChange={event => setRepoUrl(event.target.value)} placeholder="https://github.com/owner/repo" /><button type="submit" className="cloudnav-button-primary"><Plus size={15} /> 添加仓库</button></form></header><div className="cloudnav-workspace-toolbar"><div className="cloudnav-search-field"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索已追踪仓库" /></div><span className="cloudnav-count">{items.length} 个仓库</span></div><div className="cloudnav-github-list">{visible.length === 0 ? <div className="cloudnav-empty-state"><Github size={30} /><strong>还没有追踪仓库</strong><span>粘贴一个公开 GitHub 仓库地址，就能开始跟踪。</span></div> : visible.map(item => <article key={item.id} data-github-selected={selectedId === item.id ? 'true' : undefined} className={`cloudnav-github-item ${selectedId === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)}><div className="cloudnav-github-mark"><Github size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2>{item.owner}/{item.repo}</h2>{item.language && <span className="cloudnav-badge">{item.language}</span>}{typeof item.stars === 'number' && <span className="cloudnav-stars"><Star size={14} /> {item.stars.toLocaleString()}</span>}</div><p>{item.description || '尚未获取仓库描述，点击刷新读取 GitHub 元数据。'}</p><small>{item.lastFetchedAt ? `最近刷新 ${new Date(item.lastFetchedAt).toLocaleString('zh-CN')}` : '尚未刷新'}{item.error ? ` · ${item.error}` : ''}</small></div><div className="cloudnav-github-actions"><button title="刷新仓库" disabled={busyId === item.id} onClick={() => refresh(item)}><RefreshCw className={busyId === item.id ? 'animate-spin' : ''} size={16} /></button><button title="打开仓库" onClick={() => onOpenUrl?.(item.url)}><ExternalLink size={16} /></button><button title="移除追踪" onClick={() => remove(item)}><Trash2 size={16} /></button></div></article>)}</div></section>;
};

export default GithubPage;

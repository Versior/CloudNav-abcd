import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BookOpen, Check, Clock3, Download, ExternalLink, FileText, Github, Highlighter,
  Lightbulb,
  Inbox, Keyboard, Search, Sparkles, Star, Tag, Trash2, Upload, Volume2, X, Radio,
} from 'lucide-react';
import { GITHUB_WATCH_KEY, INSPIRATIONS_KEY, READ_LATER_KEY } from '../constants/storageKeys';
import type { AIConfig, ReadingDocument, ReadingDocumentStatus } from '../types';
import { buildRssSourceSummary, readRssState } from '../services/rssService';
import { normalizeReadLater } from '../services/readLaterService';
import { normalizeInspirations } from '../services/inspirationService';
import { normalizeGithubWatch } from '../services/githubService';
import { readWorkspaceList, WORKSPACE_DATA_CHANGED_EVENT } from '../services/workspaceStorage';
import { readReadingDocuments, readReadingViews, writeReadingDocuments, writeReadingViews } from '../services/readingStorage';
import {
  addReadingHighlight,
  readingDocumentFromRss,
  searchReadingDocuments,
  toggleReadingStar,
  transitionReadingDocument,
  upsertReadingDocument,
} from '../services/readingWorkspace';
import { fetchReadableDocument } from '../services/contentService';
import { summarizeWorkbench } from '../services/geminiService';

interface ReadingWorkspacePageProps {
  initialId?: string;
  onInitialIdConsumed?: () => void;
  onOpenUrl?: (url: string) => void;
  onNotice?: (message: string) => void;
  initialCapture?: { title?: string; url?: string };
  aiConfig?: AIConfig;
}

const STATUS_LABELS: Record<ReadingDocumentStatus, string> = { inbox: 'Inbox', later: '稍后阅读', archive: '已归档' };

const sourceDocuments = (): ReadingDocument[] => {
  const documents = readReadingDocuments();
  const candidates = [
    ...readRssState().articles.map(readingDocumentFromRss),
    ...readWorkspaceList(READ_LATER_KEY, normalizeReadLater).map(item => ({
      id: `later:${item.id}`, title: item.title, url: item.url, type: item.kind === 'rss' ? 'rss' as const : item.kind === 'github' ? 'github' as const : 'article' as const,
      status: item.status === 'archived' ? 'archive' as const : item.status === 'read' ? 'archive' as const : 'later' as const,
      unread: item.status === 'unread', starred: false, tags: [], content: item.summary, summary: item.summary, source: item.source,
      highlights: [], progress: 0, readingPosition: 0, createdAt: item.addedAt, updatedAt: item.updatedAt,
    })),
    ...readWorkspaceList(INSPIRATIONS_KEY, normalizeInspirations).map(item => ({
      id: `inspiration:${item.id}`, title: item.title, url: item.sourceUrl || `cloudnav://inspiration/${item.id}`, type: 'note' as const,
      status: item.status === 'archived' ? 'archive' as const : 'inbox' as const, unread: item.status === 'active', starred: true,
      tags: item.tags, content: item.content, summary: item.aiSummary, source: item.sourceTitle, highlights: [], progress: 0, readingPosition: 0,
      createdAt: item.createdAt, updatedAt: item.updatedAt,
    })),
    ...readWorkspaceList(GITHUB_WATCH_KEY, normalizeGithubWatch).map(item => ({
      id: `github:${item.id}`, title: `${item.owner}/${item.repo}`, url: item.url, type: 'github' as const, status: 'inbox' as const,
      unread: true, starred: false, tags: item.language ? [item.language] : [], content: item.readme, summary: item.description,
      source: 'GitHub', highlights: [], progress: 0, readingPosition: 0, createdAt: item.lastFetchedAt || Date.now(), updatedAt: item.lastFetchedAt || Date.now(),
    })),
  ];
  let next = documents;
  for (const candidate of candidates) {
    const existing = next.find(item => item.url === candidate.url);
    if (!existing) next = upsertReadingDocument(next, candidate, candidate.updatedAt);
    else if ((!existing.content && candidate.content) || (!existing.summary && candidate.summary)) {
      next = next.map(item => item.id === existing.id ? { ...item, content: item.content || candidate.content, summary: item.summary || candidate.summary, source: item.source || candidate.source } : item);
    }
  }
  return next;
};

const ReadingWorkspacePage: React.FC<ReadingWorkspacePageProps> = ({ initialId, onInitialIdConsumed, onOpenUrl, onNotice, initialCapture, aiConfig }) => {
  const [documents, setDocuments] = useState<ReadingDocument[]>(sourceDocuments);
  const [views, setViews] = useState(() => readReadingViews());
  const [status, setStatus] = useState<ReadingDocumentStatus>('inbox');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionText, setSelectionText] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [importInputKey, setImportInputKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const readerRef = useRef<HTMLElement>(null);

  const syncSources = useCallback(() => {
    const next = sourceDocuments();
    setDocuments(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    if (next.length && !selectedId) setSelectedId(next[0].id);
  }, [selectedId]);

  useEffect(() => {
    const handler = () => syncSources();
    window.addEventListener(WORKSPACE_DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(WORKSPACE_DATA_CHANGED_EVENT, handler);
  }, [syncSources]);

  const persist = useCallback((next: ReadingDocument[]) => {
    const normalized = writeReadingDocuments(next);
    setDocuments(normalized);
    return normalized;
  }, []);

  const saveView = () => {
    const name = window.prompt('保存当前过滤视图', `${STATUS_LABELS[status]} · ${query.trim() || '全部'}`)?.trim();
    if (!name) return;
    const now = Date.now();
    const next = [...views.filter(view => view.name !== name), { id: `view-${now}`, name, query: [query.trim(), `status:${status}`].filter(Boolean).join(' '), pinned: true, createdAt: now, updatedAt: now }];
    setViews(writeReadingViews(next));
    onNotice?.('过滤视图已保存');
  };

  const rssState = useMemo(() => readRssState(), [documents]);
  const sourceSummaries = useMemo(() => buildRssSourceSummary(rssState), [rssState]);
  const sourceFiltered = useMemo(() => documents.filter(item => {
    if (sourceFilter === 'all') return true;
    if (sourceFilter.startsWith('rss:')) return item.feedId === sourceFilter.slice(4);
    return item.type === sourceFilter;
  }), [documents, sourceFilter]);
  const visible = useMemo(() => searchReadingDocuments(query, sourceFiltered.filter(item => item.status === status && !item.deletedAt), 200), [query, sourceFiltered, status]);
  const selected = documents.find(item => item.id === selectedId) || visible[0];
  const sourceOptions = useMemo(() => [
    { id: 'all', title: '全部内容', count: documents.filter(item => item.status === status && !item.deletedAt).length, unread: documents.filter(item => item.status === status && item.unread && !item.deletedAt).length, kind: 'all' },
    ...sourceSummaries.slice(1).map(source => ({ id: source.id, title: source.title, count: source.total, unread: source.unread, kind: 'rss' })),
    ...(['article', 'note', 'github'] as const).map(kind => ({
      id: kind,
      title: kind === 'article' ? '网页文章' : kind === 'note' ? '灵感笔记' : 'GitHub',
      count: documents.filter(item => item.type === kind && item.status === status && !item.deletedAt).length,
      unread: documents.filter(item => item.type === kind && item.status === status && item.unread && !item.deletedAt).length,
      kind,
    })),
  ], [documents, sourceSummaries, status]);
  const activeSource = sourceOptions.find(option => option.id === sourceFilter) || sourceOptions[0];

  useEffect(() => {
    if (!selected) {
      setNoteDraft('');
      return;
    }
    setNoteDraft(selected.note || '');
    setTagDraft(selected.tags.join(', '));
    if (selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (!initialId || !documents.some(document => document.id === initialId)) return;
    const target = documents.find(document => document.id === initialId);
    if (!target) return;
    setStatus(target.status);
    setQuery('');
    setSelectedId(target.id);
    onInitialIdConsumed?.();
  }, [documents, initialId, onInitialIdConsumed]);

  useEffect(() => {
    if (initialCapture?.url) setNewUrl(initialCapture.url);
    if (initialCapture?.title) setNewTitle(initialCapture.title);
  }, [initialCapture?.title, initialCapture?.url]);

  const selectDocument = (id: string) => {
    setSelectedId(id);
    setSelectionText('');
    requestAnimationFrame(() => readerRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const handleReaderScroll = (event: React.UIEvent<HTMLElement>) => {
    if (!selected) return;
    const element = event.currentTarget;
    const progress = element.scrollHeight > element.clientHeight ? element.scrollTop / (element.scrollHeight - element.clientHeight) : 0;
    if (Math.abs(progress - selected.progress) > 0.05) {
      persist(documents.map(item => item.id === selected.id ? { ...item, progress, unread: false, updatedAt: Date.now() } : item));
    }
  };

  const changeStatus = (nextStatus: ReadingDocumentStatus) => {
    if (!selected) return;
    persist(transitionReadingDocument(documents, selected.id, nextStatus));
    onNotice?.(`已移动到${STATUS_LABELS[nextStatus]}`);
    const next = visible.find(item => item.id !== selected.id);
    if (next) setSelectedId(next.id);
  };

  const toggleStar = () => {
    if (!selected) return;
    persist(toggleReadingStar(documents, selected.id));
  };

  const saveNote = () => {
    if (!selected) return;
    persist(documents.map(item => item.id === selected.id ? { ...item, note: noteDraft.trim() || undefined, tags: tagDraft.split(',').map(tag => tag.trim()).filter(Boolean), updatedAt: Date.now() } : item));
    onNotice?.('文档笔记已保存');
  };

  const summarize = async () => {
    if (!selected) return;
    if (!aiConfig?.apiKey && !aiConfig?.hasApiKey) { onNotice?.('请先在设置 → AI 中配置 API'); return; }
    setIsSummarizing(true);
    try {
      const result = await summarizeWorkbench({ title: selected.title, summary: selected.content || selected.summary || '', sourceTitle: selected.source || '阅读库' }, aiConfig);
      persist(documents.map(item => item.id === selected.id ? { ...item, aiSummary: result.summary, updatedAt: Date.now() } : item));
      onNotice?.('AI 摘要已保存');
    } catch (error) {
      onNotice?.(error instanceof Error ? error.message : 'AI 摘要失败');
    } finally {
      setIsSummarizing(false);
    }
  };

  const highlight = () => {
    if (!selected || !selectionText.trim()) return;
    persist(addReadingHighlight(documents, selected.id, selectionText));
    setSelectionText('');
    window.getSelection()?.removeAllRanges();
    onNotice?.('已保存高亮');
  };

  const toggleSelected = (id: string) => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const runBatch = (nextStatus: ReadingDocumentStatus | 'delete') => {
    if (!selectedIds.size) return;
    const next = nextStatus === 'delete'
      ? documents.map(item => selectedIds.has(item.id) ? { ...item, deletedAt: Date.now(), status: 'archive' as const, unread: false, updatedAt: Date.now() } : item)
      : selectedIds.size ? transitionReadingDocument(documents, '', nextStatus).map(item => selectedIds.has(item.id) ? { ...item, status: nextStatus, unread: false, updatedAt: Date.now() } : item) : documents;
    persist(next);
    setSelectedIds(new Set());
    onNotice?.(nextStatus === 'delete' ? '已删除选中文档' : `已批量移动到${STATUS_LABELS[nextStatus]}`);
  };

  const addUrl = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newUrl.trim() || !newTitle.trim()) return;
    setIsCapturing(true);
    try {
      let input: Parameters<typeof upsertReadingDocument>[1] = { title: newTitle, url: newUrl, type: 'article', status: 'inbox', content: '', tags: [] };
      try {
        input = { ...input, ...(await fetchReadableDocument(newUrl)), title: newTitle || input.title };
      } catch {
        onNotice?.('正文抓取失败，已先保存网址，可稍后打开原文');
      }
      const next = upsertReadingDocument(documents, input);
      const added = next.find(item => item.url === newUrl.trim().replace(/#.*$/, '')) || next[0];
      persist(next);
      setSelectedId(added?.id || null);
      setNewTitle('');
      setNewUrl('');
      onNotice?.('已加入阅读 Inbox');
    } catch {
      onNotice?.('请输入有效的 http 或 https 地址');
    } finally {
      setIsCapturing(false);
    }
  };

  const exportDocuments = () => {
    const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: Date.now(), documents }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `cloudnav-reading-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const readImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const incoming = Array.isArray(payload) ? payload : payload.documents;
      if (!Array.isArray(incoming)) throw new Error('格式无效');
      const next = incoming.reduce((current, item) => upsertReadingDocument(current, item), documents);
      persist(next);
      onNotice?.(`已导入 ${next.length - documents.length} 条阅读内容`);
    } catch {
      onNotice?.('阅读库导入失败');
    } finally {
      setImportInputKey(key => key + 1);
    }
  };

  const speak = () => {
    if (!selected || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${selected.title}。${selected.content || selected.summary || '暂无正文'}`);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === '/') { event.preventDefault(); document.querySelector<HTMLInputElement>('[data-reading-search]')?.focus(); return; }
      if (event.key === '?') { event.preventDefault(); setShowShortcuts(value => !value); return; }
      if (!visible.length) return;
      const index = Math.max(0, visible.findIndex(item => item.id === selected?.id));
      if (event.key === 'j') selectDocument(visible[Math.min(index + 1, visible.length - 1)].id);
      if (event.key === 'k') selectDocument(visible[Math.max(index - 1, 0)].id);
      if (event.key === 'l') changeStatus('later');
      if (event.key === 'e') changeStatus('archive');
      if (event.key === 's') toggleStar();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <section data-page="reading-workspace" data-layout-version="reading-workspace-v2" className="cloudnav-reading-workspace cloudnav-reading-workspace-v2">
      <header className="cloudnav-reading-header-v2">
        <div className="cloudnav-reading-title-block"><div className="cloudnav-eyebrow"><BookOpen size={14} /> READING WORKSPACE</div><h1>阅读台</h1><p>把值得读的内容留下来，安静地读完，再把重点沉淀下来。</p><div className="cloudnav-reading-stats-v2"><span><strong>{documents.filter(item => item.status === 'inbox' && !item.deletedAt).length}</strong> Inbox</span><span><strong>{documents.filter(item => item.unread && !item.deletedAt).length}</strong> 未读</span><span><strong>{documents.filter(item => item.starred && !item.deletedAt).length}</strong> 收藏</span></div></div>
        <div className="cloudnav-reading-header-actions"><button type="button" onClick={exportDocuments} title="导出阅读库"><Download size={16} />导出</button><label title="导入阅读库"><Upload size={16} />导入<input key={importInputKey} type="file" accept="application/json" onChange={readImport} /></label><button type="button" onClick={() => setShowShortcuts(value => !value)} title="快捷键"><Keyboard size={16} /></button></div>
      </header>

      <div className="cloudnav-reading-controls-v2">
        <button type="button" className={`cloudnav-reading-source-trigger ${showSources ? 'is-open' : ''}`} onClick={() => setShowSources(value => !value)} aria-expanded={showSources} aria-controls="reading-source-popover"><Radio size={15} /><span>来源</span><strong>{activeSource?.title || '全部内容'}</strong><small>{activeSource?.count ?? visible.length}</small></button>
        <div className="cloudnav-segmented" aria-label="阅读状态">{(Object.keys(STATUS_LABELS) as ReadingDocumentStatus[]).map(value => <button key={value} type="button" className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{STATUS_LABELS[value]} <span>{documents.filter(item => item.status === value && !item.deletedAt).length}</span></button>)}</div>
        <label className="cloudnav-search-field cloudnav-reading-search-v2"><Search size={16} /><input data-reading-search value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索正文、笔记、作者和标签" /></label>
        <button type="button" className="cloudnav-reading-view-save" onClick={saveView}><Tag size={14} />保存视图</button>
        <button type="button" className="cloudnav-reading-immersive-toggle" onClick={() => setImmersive(value => !value)} aria-pressed={immersive}><BookOpen size={14} />{immersive ? '显示队列' : '沉浸阅读'}</button>
        {selectedIds.size > 0 && <div className="cloudnav-reading-bulk"><button type="button" onClick={() => runBatch('later')}><Clock3 size={14} />稍后</button><button type="button" onClick={() => runBatch('archive')}><Archive size={14} />归档</button><button type="button" onClick={() => runBatch('delete')}><Trash2 size={14} />删除</button></div>}
        {showSources && <div id="reading-source-popover" className="cloudnav-reading-source-popover" role="dialog" aria-label="选择阅读来源"><div className="cloudnav-reading-source-popover-head"><div><span className="cloudnav-eyebrow">SOURCES</span><strong>选择来源</strong></div><button type="button" onClick={() => setShowSources(false)} aria-label="关闭来源选择"><X size={16} /></button></div><div className="cloudnav-reading-source-options">{sourceOptions.map(option => <button key={option.id} type="button" className={sourceFilter === option.id ? 'is-active' : ''} onClick={() => { setSourceFilter(option.id); setShowSources(false); }} aria-pressed={sourceFilter === option.id}><span className="cloudnav-reading-source-icon">{option.kind === 'all' ? <Inbox size={15} /> : option.kind === 'rss' ? <Radio size={15} /> : option.kind === 'article' ? <FileText size={15} /> : option.kind === 'note' ? <Lightbulb size={15} /> : <Github size={15} />}</span><span>{option.title}</span><small>{option.unread ? `${option.unread} 未读` : `${option.count} 条`}</small></button>)}</div></div>}
      </div>

      <form className="cloudnav-reading-capture cloudnav-reading-capture-v2" onSubmit={addUrl}><span className="cloudnav-reading-capture-label"><Inbox size={15} />快速收集</span><input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="标题" aria-label="阅读标题" /><input value={newUrl} onChange={event => setNewUrl(event.target.value)} placeholder="粘贴网址，加入 Inbox" aria-label="阅读网址" /><button type="submit" disabled={isCapturing}><Inbox size={15} />{isCapturing ? '抓取正文…' : '加入 Inbox'}</button></form>

      <div className={`cloudnav-reading-grid-v2 ${immersive ? 'is-immersive' : ''}`}>
        {!immersive && <aside data-reading-region="queue" className="cloudnav-reading-list cloudnav-reading-queue-v2" aria-label="阅读队列"><div className="cloudnav-reading-list-head cloudnav-reading-list-head-v2"><div><span className="cloudnav-eyebrow">QUEUE</span><strong>{visible.length} 条内容</strong></div><button type="button" onClick={() => setSelectedIds(new Set(visible.map(item => item.id)))}>全选</button></div>{visible.length === 0 ? <div className="cloudnav-empty-state"><FileText size={30} /><strong>这里还没有内容</strong><span>粘贴网址或从 RSS、扩展和分享入口保存。</span></div> : visible.map(item => <article key={item.id} className={`cloudnav-reading-card cloudnav-reading-card-v2 ${selected?.id === item.id ? 'is-active' : ''} ${item.unread ? 'is-unread' : ''}`} onClick={() => selectDocument(item.id)}><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} onClick={event => event.stopPropagation()} aria-label={`选择 ${item.title}`} /><div className="cloudnav-reading-card-copy"><div className="cloudnav-reading-card-meta"><span>{item.source || item.type.toUpperCase()}</span>{item.progress > 0 && <span>{Math.round(item.progress * 100)}%</span>}</div><h2>{item.title}</h2><p>{item.summary || item.content || '暂无正文，打开原文阅读。'}</p><small>{item.author || item.url}</small></div>{item.starred && <Star size={15} className="is-starred" fill="currentColor" />}</article>)}</aside>}

        <article ref={readerRef} className="cloudnav-reading-reader" data-reading-region="reader" aria-label="阅读详情" onScroll={handleReaderScroll}>
          {selected ? <><div className="cloudnav-reader-actions cloudnav-reader-actions-v2"><span className="cloudnav-reader-status"><span className={`cloudnav-status-dot ${selected.unread ? 'is-unread' : ''}`} />{STATUS_LABELS[selected.status]}</span><div><button type="button" onClick={summarize} title="生成 AI 摘要" disabled={isSummarizing}><Sparkles size={16} />{isSummarizing ? '整理中' : 'AI 摘要'}</button><button type="button" onClick={toggleStar} title="收藏"><Star size={16} fill={selected.starred ? 'currentColor' : 'none'} /></button><button type="button" onClick={speak} title="朗读"><Volume2 size={16} /></button><button type="button" onClick={() => onOpenUrl?.(selected.url)} title="打开原文"><ExternalLink size={16} /></button><button type="button" onClick={() => setImmersive(value => !value)} title={immersive ? '显示文章队列' : '进入沉浸阅读'} aria-pressed={immersive}><BookOpen size={16} />{immersive ? '显示队列' : '沉浸阅读'}</button></div></div><div className="cloudnav-reader-heading cloudnav-reader-heading-v2"><div className="cloudnav-reading-card-meta"><span>{selected.source || selected.type.toUpperCase()}</span>{selected.author && <span>{selected.author}</span>}</div><h2>{selected.title}</h2><p>{selected.url}</p></div>{selectionText && <div className="cloudnav-highlight-popover"><Highlighter size={15} />已选中 {selectionText.length} 字<button type="button" onClick={highlight}>保存高亮</button></div>}{selected.aiSummary && <div className="cloudnav-reader-ai-summary"><Sparkles size={15} /><span><strong>AI 摘要</strong>{selected.aiSummary}</span></div>}<div className="cloudnav-reader-body cloudnav-reader-body-v2" onMouseUp={() => { const text = window.getSelection()?.toString().trim() || ''; if (text) setSelectionText(text); }}>{(selected.content || selected.summary || '暂无正文。打开原文获取完整内容。').split(/\n{2,}|(?<=[。！？.!?])\s+(?=\S)/).filter(Boolean).map((paragraph, index) => <p key={`${selected.id}-paragraph-${index}`}>{paragraph}</p>)}</div><section className="cloudnav-reader-notes"><div className="cloudnav-reader-section-title"><strong><Tag size={15} />文档笔记</strong><button type="button" onClick={saveNote}><Check size={14} />保存</button></div><textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} placeholder="记录这篇内容对你的意义…" /><input className="cloudnav-reader-tags" value={tagDraft} onChange={event => setTagDraft(event.target.value)} placeholder="标签，用逗号分隔" aria-label="文档标签" /><div className="cloudnav-reader-section-title"><strong><Highlighter size={15} />高亮 {selected.highlights.length}</strong></div>{selected.highlights.length === 0 ? <small>选中正文后保存第一条高亮。</small> : selected.highlights.map(item => <blockquote key={item.id}>“{item.quote}”{item.note && <footer>{item.note}</footer>}</blockquote>)}</section><div className="cloudnav-reader-footer"><button type="button" onClick={() => changeStatus('later')}><Clock3 size={15} />稍后阅读</button><button type="button" onClick={() => changeStatus('archive')}><Archive size={15} />归档</button><span><Keyboard size={14} /> `j/k` 浏览 · `l` 稍后 · `e` 归档 · `s` 收藏</span></div></> : <div className="cloudnav-reading-reader-empty"><BookOpen size={36} /><strong>选择一篇内容开始阅读</strong><span>阅读进度、高亮和笔记会自动保存在本地。</span></div>}
        </article>
      </div>

      {showShortcuts && <div className="cloudnav-shortcuts-popover"><div><strong>阅读台快捷键</strong><button type="button" onClick={() => setShowShortcuts(false)}><X size={16} /></button></div><p><kbd>j</kbd><kbd>k</kbd> 浏览内容</p><p><kbd>l</kbd> 移到稍后阅读</p><p><kbd>e</kbd> 归档　<kbd>s</kbd> 收藏</p><p><kbd>/</kbd> 搜索　<kbd>?</kbd> 打开帮助</p></div>}
    </section>
  );
};

export default ReadingWorkspacePage;

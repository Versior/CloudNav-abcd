import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Bookmark, BookmarkPlus, BookOpen, Download, ExternalLink, FileText, Globe2,
  Loader2, Pencil, Plus, Radio, RefreshCw, Rss, Search, Sparkles, Star, Trash2,
  Upload, X, Bot, PanelLeftOpen, PanelRightOpen,
} from 'lucide-react';
import type { AIConfig, RssArticle, RssFeed, RssState } from '../types';
import {
  buildOpml, buildRssSourceSummary, chooseInitialRssArticle, discoverRssFeeds, fetchRssFeed, formatRssTime, getRssFeedViewState,
  mergeRssArticles, parseOpml, readRssState, updateRssFeed, writeRssState,
} from '../services/rssService';
import { summarizeRssArticle } from '../services/geminiService';
import RssStateView from './RssStateView';
import RssArticleReader from './RssArticleReader';

interface RssReaderPageProps {
  onSaveArticle?: (article: RssArticle) => void;
  onSaveToReadLater?: (article: RssArticle) => void;
  onSaveToReading?: (article: RssArticle) => void;
  onCaptureInspiration?: (article: RssArticle) => void;
  initialArticleId?: string;
  onInitialArticleConsumed?: () => void;
  aiConfig?: AIConfig;
}

type ArticleFilter = 'all' | 'unread' | 'starred';

const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const feedIdForUrl = (url: string) => `feed-${url.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)}`;
const runWithConcurrency = async <T,>(items: T[], worker: (item: T) => Promise<void>, limit = 3) => {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      if (item) await worker(item);
    }
  });
  await Promise.all(workers);
};
const plainText = (value?: string) => (value || '')
  .replace(/<[^>]*>?/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

const RssReaderPage: React.FC<RssReaderPageProps> = ({ onSaveArticle, onSaveToReadLater, onSaveToReading, onCaptureInspiration, initialArticleId, onInitialArticleConsumed, aiConfig }) => {
  const [rssState, setRssState] = useState<RssState>(() => readRssState());
  const [selectedFeedId, setSelectedFeedId] = useState('all');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [isSourceRailOpen, setIsSourceRailOpen] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>('all');
  const [query, setQuery] = useState('');
  const [feedInput, setFeedInput] = useState('');
  const [feedInputTitle, setFeedInputTitle] = useState('');
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverInput, setDiscoverInput] = useState('');
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [loadingFeedIds, setLoadingFeedIds] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [summaryLoadingId, setSummaryLoadingId] = useState<string | null>(null);
  const [digest, setDigest] = useState('');
  const [isDigestLoading, setIsDigestLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const readerSheetRef = useRef<HTMLElement>(null);

  useEffect(() => { writeRssState(rssState); }, [rssState]);

  const updateFeedLoading = (feedId: string, loading: boolean) => setLoadingFeedIds(previous => {
    const next = new Set(previous);
    if (loading) next.add(feedId); else next.delete(feedId);
    return next;
  });

  const refreshFeed = async (feed: RssFeed) => {
    if (loadingFeedIds.has(feed.id)) return;
    updateFeedLoading(feed.id, true);
    try {
      const response = await fetchRssFeed(feed.url);
      setRssState(previous => ({
        feeds: previous.feeds.map(item => item.id === feed.id ? {
          ...item,
          url: item.preset ? item.url : (response.feed.url || item.url),
          title: item.title || response.feed.title || item.url,
          siteUrl: response.feed.siteUrl || item.siteUrl,
          icon: response.feed.icon || item.icon,
          lastFetchedAt: response.fetchedAt,
          error: undefined,
        } : item),
        articles: mergeRssArticles(previous.articles, response.articles.map(article => ({ ...article, sourceTitle: feed.preset ? feed.title : article.sourceTitle })), feed.id),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RSS 暂时无法访问';
      setRssState(previous => ({ ...previous, feeds: previous.feeds.map(item => item.id === feed.id ? { ...item, error: message } : item) }));
    } finally {
      updateFeedLoading(feed.id, false);
    }
  };

  useEffect(() => {
    const initialFeeds = readRssState().feeds;
    void runWithConcurrency(initialFeeds, refreshFeed, 3);
    const timer = window.setInterval(() => void runWithConcurrency(readRssState().feeds, refreshFeed, 3), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
    // RSS 只在打开资讯页时抓取，不阻塞首页首屏。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => rssState.articles.filter(article => !article.read).length, [rssState.articles]);
  const starredCount = useMemo(() => rssState.articles.filter(article => article.starred).length, [rssState.articles]);
  const sourceSummaries = useMemo(() => buildRssSourceSummary(rssState), [rssState]);
  const sourceFilter = selectedFeedId;
  const selectedFeed = rssState.feeds.find(feed => feed.id === selectedFeedId);
  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rssState.articles.filter(article => {
      if (selectedFeedId !== 'all' && article.feedId !== selectedFeedId) return false;
      if (articleFilter === 'unread' && article.read) return false;
      if (articleFilter === 'starred' && !article.starred) return false;
      if (!normalizedQuery) return true;
      return [article.title, plainText(article.summary), article.author, article.sourceTitle, ...(article.aiTags || [])].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [articleFilter, query, rssState.articles, selectedFeedId]);
  const selectedArticle = visibleArticles.find(article => article.id === selectedArticleId) || chooseInitialRssArticle(visibleArticles);
  const isSelectedFeedLoading = selectedFeedId === 'all' ? loadingFeedIds.size > 0 : loadingFeedIds.has(selectedFeedId);
  const selectedFeedState = isSelectedFeedLoading && visibleArticles.length === 0
    ? 'loading'
    : getRssFeedViewState(selectedFeed, visibleArticles, navigator.onLine);

  useEffect(() => {
    if (selectedArticle && selectedArticle.id !== selectedArticleId) setSelectedArticleId(selectedArticle.id);
  }, [selectedArticle, selectedArticleId]);

  useEffect(() => {
    if (!isReaderOpen) return;
    const frame = window.requestAnimationFrame(() => {
      if (readerSheetRef.current) readerSheetRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isReaderOpen, selectedArticleId]);

  const patchArticle = (articleId: string, patch: Partial<RssArticle>) => setRssState(previous => ({ ...previous, articles: previous.articles.map(article => article.id === articleId ? { ...article, ...patch } : article) }));
  const selectArticle = (article: RssArticle) => {
    setSelectedArticleId(article.id);
    setIsReaderOpen(true);
    if (!article.read) patchArticle(article.id, { read: true });
  };

  useEffect(() => {
    if (!initialArticleId) return;
    const target = rssState.articles.find(article => article.id === initialArticleId);
    if (!target) return;
    setSelectedFeedId('all');
    setArticleFilter('all');
    setQuery('');
    selectArticle(target);
    onInitialArticleConsumed?.();
    // The target is consumed after the article list has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArticleId, rssState.articles]);

  const refreshAll = () => {
    setNotice({ tone: 'info', text: '正在刷新订阅源…' });
    void runWithConcurrency(rssState.feeds, refreshFeed, 3).then(() => {
      const latest = readRssState();
      const failed = latest.feeds.filter(feed => feed.error).length;
      setNotice(failed === latest.feeds.length
        ? { tone: 'error', text: '订阅刷新失败，请检查网络或来源地址。' }
        : failed
          ? { tone: 'error', text: `${failed} 个订阅刷新失败，其余内容已更新。` }
          : { tone: 'info', text: '订阅已更新' });
      window.setTimeout(() => setNotice(null), 2400);
    });
  };

  const resetFeedEditor = () => {
    setEditingFeedId(null);
    setFeedInput('');
    setFeedInputTitle('');
    setShowAddFeed(false);
  };

  const openAddFeed = () => {
    setEditingFeedId(null);
    setFeedInput('');
    setFeedInputTitle('');
    setShowDiscover(false);
    setShowAddFeed(true);
  };

  const startEditFeed = (feed: RssFeed) => {
    setEditingFeedId(feed.id);
    setFeedInput(feed.url);
    setFeedInputTitle(feed.title);
    setSelectedFeedId(feed.id);
    setShowDiscover(false);
    setShowAddFeed(true);
  };

  const addFeed = (url: string, title = '') => {
    const normalizedUrl = url.trim();
    if (!isHttpUrl(normalizedUrl)) { setNotice({ tone: 'error', text: '请输入 http 或 https 的 RSS 地址' }); return; }
    if (rssState.feeds.some(feed => feed.url.toLowerCase() === normalizedUrl.toLowerCase())) { setNotice({ tone: 'info', text: '这个订阅已经存在' }); return; }
    let hostname = normalizedUrl;
    try { hostname = new URL(normalizedUrl).hostname; } catch {}
    const feed: RssFeed = { id: feedIdForUrl(normalizedUrl), url: normalizedUrl, title: title.trim() || hostname, addedAt: Date.now() };
    setRssState(previous => ({ ...previous, feeds: [...previous.feeds, feed] }));
    setSelectedFeedId(feed.id); resetFeedEditor();
    setDiscoveredUrls(previous => previous.filter(item => item !== normalizedUrl));
    void refreshFeed(feed);
  };

  const saveFeed = () => {
    if (!editingFeedId) {
      addFeed(feedInput, feedInputTitle);
      return;
    }

    const current = rssState.feeds.find(feed => feed.id === editingFeedId);
    if (!current) { resetFeedEditor(); return; }
    const result = updateRssFeed(current, feedInput, feedInputTitle, rssState.feeds);
    if (result.error || !result.feed) { setNotice({ tone: 'error', text: result.error || '订阅修改失败' }); return; }
    const updatedFeed = result.feed;
    const urlChanged = Boolean(result.urlChanged);

    setRssState(previous => ({
      feeds: previous.feeds.map(feed => feed.id === editingFeedId ? updatedFeed : feed),
      articles: urlChanged ? previous.articles.filter(article => article.feedId !== editingFeedId) : previous.articles,
    }));
    setSelectedFeedId(editingFeedId);
    resetFeedEditor();
    setNotice({ tone: 'info', text: '订阅已保存，正在重新抓取' });
    void refreshFeed(updatedFeed);
  };

  const removeFeed = (feed: RssFeed) => {
    setRssState(previous => ({ feeds: previous.feeds.filter(item => item.id !== feed.id), articles: previous.articles.filter(article => article.feedId !== feed.id) }));
    if (selectedFeedId === feed.id) setSelectedFeedId('all');
  };

  const handleDiscover = async () => {
    if (!isHttpUrl(discoverInput)) { setNotice({ tone: 'error', text: '请输入要检测的网站地址' }); return; }
    setIsDiscovering(true); setDiscoveredUrls([]);
    try {
      const urls = await discoverRssFeeds(discoverInput);
      setDiscoveredUrls(urls);
      setNotice({ tone: 'info', text: urls.length ? `发现 ${urls.length} 个可用候选地址` : '没有发现标准 RSS 标记，可直接粘贴订阅地址' });
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'RSS 发现失败' }); }
    finally { setIsDiscovering(false); }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const parsed = parseOpml(await file.text());
    const existing = new Set(rssState.feeds.map(feed => feed.url.toLowerCase()));
    const newFeeds = parsed.filter(item => { const key = item.url.toLowerCase(); if (existing.has(key)) return false; existing.add(key); return true; }).map((item, index) => ({ id: feedIdForUrl(item.url) || `feed-${Date.now()}-${index}`, url: item.url, title: item.title, addedAt: Date.now() }));
    if (newFeeds.length) setRssState(previous => ({ ...previous, feeds: [...previous.feeds, ...newFeeds].slice(0, 50) }));
    setNotice({ tone: 'info', text: newFeeds.length ? `已导入 ${newFeeds.length} 个订阅` : '没有发现新的订阅地址' });
  };

  const handleExport = () => {
    const blob = new Blob([buildOpml(rssState.feeds)], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'cloudnav-rss-subscriptions.opml'; anchor.click(); URL.revokeObjectURL(url);
  };

  const generateArticleSummary = async (article: RssArticle) => {
    if (!aiConfig?.apiKey && !aiConfig?.hasApiKey) { setNotice({ tone: 'error', text: '请先在设置 → AI 中配置 API Key' }); return; }
    setSummaryLoadingId(article.id);
    try {
      const result = await summarizeRssArticle({ ...article, summary: plainText(article.content || article.summary) }, aiConfig);
      patchArticle(article.id, { aiSummary: result.summary, aiBullets: result.bullets, aiFacts: result.facts, aiActions: result.actions, aiEvidence: result.evidence, aiTags: result.tags, aiUpdatedAt: Date.now() });
    } catch (error) { setNotice({ tone: 'error', text: error instanceof Error ? error.message : '文章摘要生成失败' }); }
    finally { setSummaryLoadingId(null); }
  };

  const generateDigest = async () => {
    if (!visibleArticles.length) return;
    if (!aiConfig?.apiKey && !aiConfig?.hasApiKey) { setDigest('请先在设置 → AI 中配置 API Key，AI 简报按需生成。'); return; }
    setIsDigestLoading(true);
    try {
      const result = await summarizeRssArticle({ title: '今日资讯简报', url: 'https://cloudnav.local/rss', sourceTitle: 'CloudNav RSS', summary: visibleArticles.slice(0, 18).map(article => `${article.sourceTitle || '未知来源'}｜${article.title}｜${plainText(article.content || article.summary).slice(0, 700)}`).join('\n') }, aiConfig);
      setDigest(result.summary + (result.facts?.length ? ` ${result.facts.join('；')}` : result.bullets.length ? ` ${result.bullets.join('；')}` : ''));
    } catch (error) { setDigest(error instanceof Error ? error.message : 'AI 简报生成失败'); }
    finally { setIsDigestLoading(false); }
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === 'Escape') {
        setIsReaderOpen(false);
        setIsSourceRailOpen(false);
        return;
      }
      if (event.key === 'r') {
        event.preventDefault();
        if (selectedFeed) void refreshFeed(selectedFeed); else refreshAll();
        return;
      }
      if (!visibleArticles.length) return;
      const selectedIndex = Math.max(0, visibleArticles.findIndex(article => article.id === selectedArticle?.id));
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        const delta = event.key === 'j' ? 1 : -1;
        const next = visibleArticles[(selectedIndex + delta + visibleArticles.length) % visibleArticles.length];
        if (next) selectArticle(next);
      } else if (event.key === 'o' && selectedArticle) {
        event.preventDefault();
        window.open(selectedArticle.url, '_blank', 'noopener,noreferrer');
      } else if (event.key === 's' && selectedArticle) {
        event.preventDefault();
        patchArticle(selectedArticle.id, { starred: !selectedArticle.starred });
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [selectedArticle, selectedFeed, visibleArticles]);

  return (
    <section data-rss-view="reader" data-rss-layout="focus-flow" data-layout-version="reader-v5" className="cloudnav-rss-reader cloudnav-rss-reader-v5">
      <header className="cloudnav-rss-v5-header"><div><span className="cloudnav-rss-v5-kicker">READING DESK</span><h1>资讯阅读台</h1><p>先扫读文章流，需要深入时再打开独立阅读层。</p></div><div className="cloudnav-rss-header-actions"><button type="button" className="cloudnav-quiet-button" onClick={generateDigest} disabled={isDigestLoading}><Bot size={15} />{isDigestLoading ? '整理中…' : '今日 AI 简报'}</button><button type="button" className="cloudnav-quiet-button" onClick={refreshAll}><RefreshCw size={15} />刷新</button><button type="button" className="cloudnav-primary-button" onClick={showAddFeed && !editingFeedId ? () => setShowAddFeed(false) : openAddFeed}><Plus size={15} />添加订阅</button></div></header>

      <div data-rss-region="source-rail" data-sources="rss" className="cloudnav-source-rail cloudnav-rss-source-rail" aria-label="RSS 订阅源">
        <div className="cloudnav-source-rail-label"><Rss size={15} /><strong>订阅源</strong><span>{rssState.feeds.length}</span></div>
        <div className="cloudnav-source-rail-list">
          {sourceSummaries.map(source => <button type="button" key={source.id} className={`cloudnav-source-option ${sourceFilter === source.id ? 'is-active' : ''} ${source.error ? 'has-error' : ''}`} onClick={() => { setSelectedFeedId(source.id); setArticleFilter('all'); }} aria-pressed={sourceFilter === source.id}>
            <span className="cloudnav-source-option-icon">{source.id === 'all' ? <Globe2 size={14} /> : <Radio size={14} />}</span><span>{source.title}</span><small>{source.unread ? `${source.unread} 未读` : `${source.total} 篇`}</small>
          </button>)}
        </div>
      </div>
      <div className="cloudnav-rss-v5-stats" aria-label="资讯概览"><span><strong>{rssState.feeds.length}</strong><small>订阅源</small></span><span><strong>{unreadCount}</strong><small>未读文章</small></span><span><strong>{starredCount}</strong><small>稍后阅读</small></span><span className="cloudnav-rss-v5-stats-note">{selectedFeedId === 'all' ? '全部资讯' : selectedFeed?.title || '当前订阅'} · {visibleArticles.length} 篇</span></div>
      {digest && <div className="cloudnav-rss-digest" data-rss-ai-summary><Bot size={17} /><div><strong>今日 AI 简报</strong><p>{digest}</p></div><button type="button" onClick={() => setDigest('')} aria-label="关闭简报"><X size={14} /></button></div>}
      {notice && <div className={`cloudnav-rss-notice ${notice.tone === 'error' ? 'is-error' : ''}`}><AlertCircle size={15} />{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="关闭提示"><X size={14} /></button></div>}

      {(showAddFeed || showDiscover) && <section className="cloudnav-rss-intake cloudnav-rss-v5-intake"><form data-rss-editor onSubmit={event => { event.preventDefault(); saveFeed(); }}><label>{editingFeedId ? '编辑订阅' : '添加 RSS / Atom / JSON Feed'}</label><input aria-label="RSS 地址" value={feedInput} onChange={event => setFeedInput(event.target.value)} placeholder="https://example.com/rss.xml" required /><div className="cloudnav-rss-intake-row"><input aria-label="订阅名称" value={feedInputTitle} onChange={event => setFeedInputTitle(event.target.value)} placeholder={editingFeedId ? '订阅名称' : '名称（可选）'} required={Boolean(editingFeedId)} /><button type="submit">{editingFeedId ? '保存修改' : '订阅'}</button>{editingFeedId && <button type="button" className="cloudnav-rss-cancel-edit" onClick={resetFeedEditor}>取消</button>}</div></form><div><label>自动发现网站订阅</label><div className="cloudnav-rss-intake-row"><input value={discoverInput} onChange={event => setDiscoverInput(event.target.value)} placeholder="粘贴网站首页" /><button type="button" onClick={handleDiscover} disabled={isDiscovering}>{isDiscovering ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}检测</button></div>{discoveredUrls.map(url => <button type="button" key={url} className="cloudnav-rss-discovered" onClick={() => addFeed(url)}><Rss size={13} />{url}<Plus size={14} /></button>)}</div></section>}

      <div className="cloudnav-rss-v5-toolbar"><div className="cloudnav-rss-v5-toolbar-main"><label className="cloudnav-rss-v5-search"><Search size={16} /><input ref={searchInputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、来源或 AI 标签（按 / 聚焦）" /></label><div className="cloudnav-rss-v5-filters" aria-label="文章筛选"><button type="button" className={articleFilter === 'all' ? 'is-active' : ''} onClick={() => setArticleFilter('all')}>全部 <span>{rssState.articles.length}</span></button><button type="button" className={articleFilter === 'unread' ? 'is-active' : ''} onClick={() => setArticleFilter('unread')}>未读 <span>{unreadCount}</span></button><button type="button" className={articleFilter === 'starred' ? 'is-active' : ''} onClick={() => setArticleFilter('starred')}>稍后阅读 <span>{starredCount}</span></button></div></div><div className="cloudnav-rss-v5-toolbar-actions"><button type="button" data-rss-toggle="sources" aria-pressed={isSourceRailOpen} onClick={() => setIsSourceRailOpen(value => !value)}><PanelLeftOpen size={15} />{isSourceRailOpen ? '收起订阅' : '订阅来源'}</button><button type="button" data-rss-toggle="reader" aria-pressed={isReaderOpen} onClick={() => setIsReaderOpen(value => !value)}><PanelRightOpen size={15} />{isReaderOpen ? '关闭阅读' : '阅读层'}</button><button type="button" onClick={() => { setShowDiscover(true); setShowAddFeed(false); setEditingFeedId(null); }}><Sparkles size={15} />自动发现 RSS</button><input ref={importInputRef} type="file" accept=".opml,.xml,text/xml,application/xml" onChange={handleImport} className="hidden" /><button type="button" title="导入 OPML" onClick={() => importInputRef.current?.click()}><Upload size={15} />导入</button><button type="button" title="导出 OPML" onClick={handleExport}><Download size={15} />导出</button></div></div>

      <main data-rss-region="article-stream" className="cloudnav-rss-v5-stream"><div className="cloudnav-rss-v5-stream-head"><div><span className="cloudnav-rss-v5-kicker">{selectedFeedId === 'all' ? 'ALL SOURCES' : 'SOURCE'}</span><h2>{selectedFeedId === 'all' ? '全部资讯' : selectedFeed?.title || '资讯'}</h2><p>{selectedFeed?.lastFetchedAt ? `上次更新 ${formatRssTime(selectedFeed.lastFetchedAt)}` : '按时间倒序排列，点击文章打开阅读层'}</p></div><span className="cloudnav-rss-v5-result-count">{visibleArticles.length} 篇</span></div>{visibleArticles.length ? <div className="cloudnav-rss-v5-rows">{visibleArticles.map(article => <button type="button" key={article.id} className={`cloudnav-rss-v5-row cloudnav-rss-article-row ${selectedArticle?.id === article.id ? 'is-selected' : ''} ${article.read ? 'is-read' : ''}`} onClick={() => selectArticle(article)}><span className="cloudnav-rss-v5-row-index" aria-hidden="true">{article.read ? '—' : '●'}</span><span className="cloudnav-rss-v5-row-copy"><strong>{article.title}</strong><span>{article.sourceTitle || rssState.feeds.find(feed => feed.id === article.feedId)?.title || '未知来源'} · {formatRssTime(article.publishedAt)}{article.author ? ` · ${article.author}` : ''}</span><small>{plainText(article.aiSummary || article.summary) || '没有摘要，打开原文查看详情'}</small></span><span className="cloudnav-rss-v5-row-status">{article.aiSummary && <Bot size={15} aria-label="已有 AI 摘要" />}{article.starred && <Star size={15} className="is-starred" aria-label="已收藏" />}<PanelRightOpen size={15} aria-hidden="true" /></span></button>)}</div> : <RssStateView state={selectedFeedState === 'ready' ? 'empty' : selectedFeedState} title={selectedFeedState === 'loading' ? '正在更新资讯' : rssState.articles.length ? '没有符合条件的文章' : '等待资讯'} description={selectedFeedState === 'loading' ? `正在抓取 ${selectedFeedId === 'all' ? rssState.feeds.length : 1} 个订阅源，文章出现后会自动显示。` : rssState.articles.length ? '换个关键词或切换筛选条件。' : selectedFeed?.error || '默认订阅源正在抓取，稍等片刻即可阅读。'} onRetry={selectedFeed ? () => void refreshFeed(selectedFeed) : refreshAll} />}</main>

      {isSourceRailOpen && <div className="cloudnav-rss-source-drawer-backdrop" aria-hidden="true" onClick={() => setIsSourceRailOpen(false)} />}
      <aside data-rss-region="source-drawer" className="cloudnav-rss-source-drawer" aria-label="RSS 订阅来源" hidden={!isSourceRailOpen}><div className="cloudnav-rss-source-drawer-head"><div><span className="cloudnav-rss-v5-kicker">SOURCES</span><h2>订阅来源</h2></div><button type="button" onClick={() => setIsSourceRailOpen(false)} aria-label="收起订阅来源" title="收起订阅来源"><X size={16} /></button></div><div className="cloudnav-rss-source-drawer-body"><button type="button" className={selectedFeedId === 'all' && articleFilter === 'all' ? 'is-active' : ''} onClick={() => { setSelectedFeedId('all'); setArticleFilter('all'); setIsSourceRailOpen(false); }}><Globe2 size={15} /><span>全部资讯</span><em>{rssState.articles.length}</em></button><button type="button" className={articleFilter === 'unread' ? 'is-active' : ''} onClick={() => { setSelectedFeedId('all'); setArticleFilter('unread'); setIsSourceRailOpen(false); }}><Radio size={15} /><span>未读文章</span><em>{unreadCount}</em></button><button type="button" className={articleFilter === 'starred' ? 'is-active' : ''} onClick={() => { setSelectedFeedId('all'); setArticleFilter('starred'); setIsSourceRailOpen(false); }}><Star size={15} /><span>稍后阅读</span><em>{starredCount}</em></button><div className="cloudnav-rss-source-divider" /><div className="cloudnav-rss-source-subtitle">我的订阅</div>{rssState.feeds.map(feed => <div className={`cloudnav-rss-source-item ${feed.error ? 'is-error' : ''} ${loadingFeedIds.has(feed.id) ? 'is-loading' : ''}`} key={feed.id}><button type="button" className={selectedFeedId === feed.id ? 'is-active' : ''} onClick={() => { setSelectedFeedId(feed.id); setArticleFilter('all'); setIsSourceRailOpen(false); }}><span className="cloudnav-rss-source-icon">{loadingFeedIds.has(feed.id) ? <RefreshCw size={13} className="animate-spin" /> : feed.icon ? <img src={feed.icon} alt="" /> : <Rss size={13} />}</span><span>{feed.title}</span><em>{rssState.articles.filter(article => article.feedId === feed.id && !article.read).length || ''}</em></button><button type="button" className="cloudnav-rss-source-edit" onClick={() => startEditFeed(feed)} aria-label={`编辑 ${feed.title}`} title="编辑订阅"><Pencil size={13} /></button><button type="button" className="cloudnav-rss-source-remove" onClick={() => removeFeed(feed)} aria-label={`移除 ${feed.title}`}><Trash2 size={13} /></button></div>)}<div className="cloudnav-rss-source-foot"><FileText size={14} /><span>只保留有内容的中文源</span></div></div></aside>

      {isReaderOpen && <div className="cloudnav-rss-reader-sheet-backdrop" aria-hidden="true" onClick={() => setIsReaderOpen(false)} />}
      <div data-rss-region="reader-sheet" data-reader-actions="稍后阅读,阅读 Inbox,记入灵感" role="dialog" aria-modal="true" aria-label="文章阅读" hidden={!isReaderOpen}>
        <RssArticleReader
          article={selectedArticle}
          feedTitle={selectedFeed?.title}
          isOpen={isReaderOpen}
          loadingSummary={summaryLoadingId === selectedArticle?.id}
          readerSheetRef={readerSheetRef}
          onClose={() => setIsReaderOpen(false)}
          onToggleStar={() => selectedArticle && patchArticle(selectedArticle.id, { starred: !selectedArticle.starred })}
          onGenerateSummary={() => selectedArticle ? void generateArticleSummary(selectedArticle) : undefined}
          onSaveArticle={onSaveArticle}
          onSaveToReadLater={onSaveToReadLater}
          onSaveToReading={onSaveToReading}
          onCaptureInspiration={onCaptureInspiration}
        />
      </div>
    </section>
  );
};

export default RssReaderPage;

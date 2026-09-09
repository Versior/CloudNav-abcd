import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  Check,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { RssArticle, RssFeed, RssState } from '../types';
import {
  buildOpml,
  discoverRssFeeds,
  fetchRssFeed,
  formatRssTime,
  getRssFeedViewState,
  mergeRssArticles,
  parseOpml,
  readRssState,
  writeRssState,
} from '../services/rssService';
import RssSourceRail from './RssSourceRail';
import RssArticleList from './RssArticleList';
import RssArticleReader from './RssArticleReader';
import RssStateView from './RssStateView';

interface RssReaderPageProps {
  onSaveArticle?: (article: RssArticle) => void;
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

const RssReaderPage: React.FC<RssReaderPageProps> = ({ onSaveArticle }) => {
  const [rssState, setRssState] = useState<RssState>(() => readRssState());
  const [selectedFeedId, setSelectedFeedId] = useState('all');
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>('all');
  const [query, setQuery] = useState('');
  const [feedInput, setFeedInput] = useState('');
  const [feedInputTitle, setFeedInputTitle] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverInput, setDiscoverInput] = useState('');
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([]);
  const [loadingFeedIds, setLoadingFeedIds] = useState<Set<string>>(new Set());
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    writeRssState(rssState);
  }, [rssState]);

  const updateFeedLoading = (feedId: string, loading: boolean) => {
    setLoadingFeedIds(previous => {
      const next = new Set(previous);
      if (loading) next.add(feedId);
      else next.delete(feedId);
      return next;
    });
  };

  const refreshFeed = async (feed: RssFeed) => {
    if (loadingFeedIds.has(feed.id)) return;
    updateFeedLoading(feed.id, true);
    try {
      const response = await fetchRssFeed(feed.url);
      setRssState(previous => ({
        feeds: previous.feeds.map(item => item.id === feed.id ? {
          ...item,
          url: item.preset ? item.url : (response.feed.url || item.url),
          title: item.preset ? item.title : response.feed.title || item.title,
          siteUrl: response.feed.siteUrl || item.siteUrl,
          icon: response.feed.icon || item.icon,
          lastFetchedAt: response.fetchedAt,
          error: undefined,
        } : item),
        articles: mergeRssArticles(previous.articles, response.articles.map(article => ({
          ...article,
          sourceTitle: feed.preset ? feed.title : article.sourceTitle,
        })), feed.id),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'RSS 暂时无法访问';
      setRssState(previous => ({
        ...previous,
        feeds: previous.feeds.map(item => item.id === feed.id ? { ...item, error: message } : item),
      }));
    } finally {
      updateFeedLoading(feed.id, false);
    }
  };

  useEffect(() => {
    const initialFeeds = readRssState().feeds;
    void Promise.all(initialFeeds.map(feed => refreshFeed(feed)));
    const timer = window.setInterval(() => {
      void Promise.all(readRssState().feeds.map(feed => refreshFeed(feed)));
    }, 15 * 60 * 1000);
    // RSS 只在打开资讯页时抓取，不阻塞导航首页首屏。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => window.clearInterval(timer);
  }, []);

  const unreadCount = useMemo(() => rssState.articles.filter(article => !article.read).length, [rssState.articles]);
  const starredCount = useMemo(() => rssState.articles.filter(article => article.starred).length, [rssState.articles]);
  const selectedFeed = rssState.feeds.find(feed => feed.id === selectedFeedId);

  const visibleArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rssState.articles.filter(article => {
      if (selectedFeedId !== 'all' && article.feedId !== selectedFeedId) return false;
      if (articleFilter === 'unread' && article.read) return false;
      if (articleFilter === 'starred' && !article.starred) return false;
      if (!normalizedQuery) return true;
      return [article.title, article.summary, article.author, article.sourceTitle].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [articleFilter, query, rssState.articles, selectedFeedId]);

  const selectedFeedState = getRssFeedViewState(selectedFeed, visibleArticles, navigator.onLine);

  const refreshAll = () => {
    setNotice({ tone: 'info', text: '正在更新订阅…' });
    void Promise.all(rssState.feeds.map(feed => refreshFeed(feed))).finally(() => {
      setNotice({ tone: 'info', text: '订阅已更新' });
      window.setTimeout(() => setNotice(null), 2400);
    });
  };

  const addFeed = (url: string, title = '') => {
    const normalizedUrl = url.trim();
    if (!isHttpUrl(normalizedUrl)) {
      setNotice({ tone: 'error', text: '请输入 http 或 https 的 RSS 地址' });
      return;
    }
    if (rssState.feeds.some(feed => feed.url.toLowerCase() === normalizedUrl.toLowerCase())) {
      setNotice({ tone: 'info', text: '这个订阅已经存在' });
      return;
    }
    let hostname = normalizedUrl;
    try { hostname = new URL(normalizedUrl).hostname; } catch {}
    const feed: RssFeed = {
      id: feedIdForUrl(normalizedUrl),
      url: normalizedUrl,
      title: title.trim() || hostname,
      addedAt: Date.now(),
    };
    setRssState(previous => ({ ...previous, feeds: [...previous.feeds, feed] }));
    setSelectedFeedId(feed.id);
    setFeedInput('');
    setFeedInputTitle('');
    setShowAddFeed(false);
    setDiscoveredUrls(previous => previous.filter(item => item !== normalizedUrl));
    void refreshFeed(feed);
  };

  const removeFeed = (feed: RssFeed) => {
    setRssState(previous => ({
      feeds: previous.feeds.filter(item => item.id !== feed.id),
      articles: previous.articles.filter(article => article.feedId !== feed.id),
    }));
    if (selectedFeedId === feed.id) setSelectedFeedId('all');
  };

  const patchArticle = (articleId: string, patch: Partial<RssArticle>) => {
    setRssState(previous => ({
      ...previous,
      articles: previous.articles.map(article => article.id === articleId ? { ...article, ...patch } : article),
    }));
  };

  const openArticle = (article: RssArticle) => {
    patchArticle(article.id, { read: true });
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const handleDiscover = async () => {
    if (!isHttpUrl(discoverInput)) {
      setNotice({ tone: 'error', text: '请输入要检测的网站地址' });
      return;
    }
    setIsDiscovering(true);
    setDiscoveredUrls([]);
    try {
      const urls = await discoverRssFeeds(discoverInput);
      setDiscoveredUrls(urls);
      setNotice({ tone: 'info', text: urls.length ? `发现 ${urls.length} 个可用候选地址` : '没有发现标准 RSS 标记，可直接粘贴订阅地址' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'RSS 发现失败' });
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const parsed = parseOpml(await file.text());
    const existing = new Set(rssState.feeds.map(feed => feed.url.toLowerCase()));
    const newFeeds = parsed.filter(item => {
      const key = item.url.toLowerCase();
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    }).map((item, index) => ({
      id: feedIdForUrl(item.url) || `feed-${Date.now()}-${index}`,
      url: item.url,
      title: item.title,
      addedAt: Date.now(),
    }));
    const added = newFeeds.length;
    if (added) setRssState(previous => ({ ...previous, feeds: [...previous.feeds, ...newFeeds].slice(0, 50) }));
    setNotice({ tone: 'info', text: added ? `已导入 ${added} 个订阅` : '没有发现新的订阅地址' });
  };

  const handleExport = () => {
    const blob = new Blob([buildOpml(rssState.feeds)], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'cloudnav-rss-subscriptions.opml';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section data-rss-view="reader" className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#172554] via-[#1d4ed8] to-[#38bdf8] px-6 py-7 text-white shadow-[0_20px_55px_rgba(37,99,235,0.22)] lg:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100"><Rss size={15} /> CloudNav Reader</div>
            <h1 className="text-3xl font-bold tracking-tight">RSS 资讯中心</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">自动聚合中文 AI、每日热点、GitHub 热门项目和你订阅的网站。打开页面时后台刷新，阅读进度保存在本地。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={refreshAll} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"><RefreshCw size={15} />刷新全部</button>
            <button type="button" onClick={() => setShowAddFeed(value => !value)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-lg transition hover:bg-blue-50"><Plus size={15} />添加订阅</button>
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: '订阅源', value: rssState.feeds.length, icon: Radio },
            { label: '未读文章', value: unreadCount, icon: Bookmark },
            { label: '稍后阅读', value: starredCount, icon: Star },
          ].map(item => {
            const ItemIcon = item.icon;
            return <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur"><ItemIcon size={17} className="text-blue-100" /><div><div className="text-xl font-bold">{item.value}</div><div className="text-xs text-blue-100">{item.label}</div></div></div>;
          })}
        </div>
      </div>

      {notice && <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notice.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300' : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300'}`}><AlertCircle size={16} />{notice.text}<button type="button" onClick={() => setNotice(null)} className="ml-auto rounded p-1 hover:bg-black/5" aria-label="关闭提示"><X size={14} /></button></div>}

      {(showAddFeed || showDiscover) && <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:grid-cols-2">
        {showAddFeed && <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Plus size={16} className="text-blue-500" />直接添加 RSS / Atom / JSON Feed</div>
          <div className="space-y-2">
            <input value={feedInput} onChange={event => setFeedInput(event.target.value)} placeholder="https://example.com/rss.xml" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900" />
            <div className="flex gap-2"><input value={feedInputTitle} onChange={event => setFeedInputTitle(event.target.value)} placeholder="名称（可选）" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-900" /><button type="button" onClick={() => addFeed(feedInput, feedInputTitle)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">订阅</button></div>
          </div>
        </div>}
        {showDiscover && <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100"><Sparkles size={16} className="text-violet-500" />自动发现</div>
          <div className="flex gap-2"><input value={discoverInput} onChange={event => setDiscoverInput(event.target.value)} placeholder="粘贴网站首页，自动寻找 RSS" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900" /><button type="button" onClick={handleDiscover} disabled={isDiscovering} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">{isDiscovering ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}检测</button></div>
          {discoveredUrls.length > 0 && <div className="mt-3 space-y-2">{discoveredUrls.map(url => <button type="button" key={url} onClick={() => addFeed(url)} className="flex w-full items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-left text-xs text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-200"><Rss size={13} /><span className="min-w-0 flex-1 truncate">{url}</span><Plus size={14} /></button>)}</div>}
        </div>}
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setShowAddFeed(true); setShowDiscover(false); }} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><Plus size={14} />添加订阅</button>
          <button type="button" onClick={() => { setShowDiscover(true); setShowAddFeed(false); }} className="inline-flex items-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"><Sparkles size={14} />自动发现</button>
          <input ref={importInputRef} type="file" accept=".opml,.xml,text/xml,application/xml" onChange={handleImport} className="hidden" />
          <button type="button" onClick={() => importInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Upload size={14} />导入 OPML</button>
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Download size={14} />导出 OPML</button>
        </div>
        <div className="relative w-full sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索资讯标题或摘要" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800" /></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <RssSourceRail className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">我的订阅</div>
          <button type="button" onClick={() => setSelectedFeedId('all')} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedFeedId === 'all' ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Globe2 size={16} /><span className="flex-1">全部资讯</span><span className="text-xs text-slate-400">{rssState.articles.length}</span></button>
          <button type="button" onClick={() => { setSelectedFeedId('all'); setArticleFilter('starred'); }} className={`mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${articleFilter === 'starred' && selectedFeedId === 'all' ? 'bg-amber-50 font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}><Star size={16} /><span className="flex-1">稍后阅读</span><span className="text-xs text-slate-400">{starredCount}</span></button>
          <div className="my-2 border-t border-slate-100 dark:border-slate-700" />
          <div className="space-y-1">{rssState.feeds.map(feed => <div key={feed.id} className="group flex items-center gap-1"><button type="button" onClick={() => { setSelectedFeedId(feed.id); setArticleFilter('all'); }} className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${selectedFeedId === feed.id ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-700"><Rss size={14} /></span><span className="min-w-0 flex-1 truncate">{feed.title}</span><span className="text-xs text-slate-400">{rssState.articles.filter(article => article.feedId === feed.id && !article.read).length || ''}</span></button><button type="button" onClick={() => removeFeed(feed)} className="rounded p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100" title={`移除 ${feed.title}`} aria-label={`移除 ${feed.title}`}><Trash2 size={13} /></button></div>)}</div>
        </RssSourceRail>

        <RssArticleList className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
            <div><div className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">{selectedFeedId === 'all' ? '全部资讯' : selectedFeed?.title || '资讯'}{selectedFeed && loadingFeedIds.has(selectedFeed.id) && <Loader2 size={15} className="animate-spin text-blue-500" />}</div><div className="mt-1 text-xs text-slate-400">{selectedFeed?.error ? `更新失败：${selectedFeed.error}` : selectedFeed?.lastFetchedAt ? `上次更新 ${formatRssTime(selectedFeed.lastFetchedAt)}` : '打开页面自动更新'}</div></div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900"><button type="button" onClick={() => setArticleFilter('all')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${articleFilter === 'all' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500'}`}>全部</button><button type="button" onClick={() => setArticleFilter('unread')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${articleFilter === 'unread' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-300' : 'text-slate-500'}`}>未读</button><button type="button" onClick={() => setArticleFilter('starred')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${articleFilter === 'starred' ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-300' : 'text-slate-500'}`}>收藏</button></div>
          </div>
          <RssArticleReader>
          {visibleArticles.length > 0 ? <div className="divide-y divide-slate-100 dark:divide-slate-700">{visibleArticles.map(article => <article key={article.id} data-spatial-id={`rss-article-${article.id}`} className={`cloudnav-spatial-card group px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 ${article.read ? 'opacity-75' : ''}`}>
            <div className="flex gap-3"><div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${article.read ? 'bg-slate-200 dark:bg-slate-600' : 'bg-blue-500'}`} /><div className="min-w-0 flex-1"><button type="button" onClick={() => openArticle(article)} className="text-left text-sm font-semibold leading-6 text-slate-800 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300">{article.title}</button><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>{article.sourceTitle || rssState.feeds.find(feed => feed.id === article.feedId)?.title || '未知来源'}</span><span>·</span><span>{formatRssTime(article.publishedAt)}</span>{article.author && <><span>·</span><span>{article.author}</span></>}</div>{article.summary && <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{article.summary}</p>}<div className="mt-3 flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100"><button type="button" onClick={() => openArticle(article)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"><ExternalLink size={13} />打开</button><button type="button" onClick={() => patchArticle(article.id, { read: !article.read })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30">{article.read ? <Radio size={13} /> : <Check size={13} />}{article.read ? '标为未读' : '标为已读'}</button><button type="button" onClick={() => patchArticle(article.id, { starred: !article.starred })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs ${article.starred ? 'text-amber-500' : 'text-slate-500'} hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30`}><Star size={13} className={article.starred ? 'fill-current' : ''} />{article.starred ? '已收藏' : '收藏'}</button>{onSaveArticle && <button type="button" onClick={() => onSaveArticle(article)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"><Bookmark size={13} />保存到网站</button>}</div></div><button type="button" onClick={() => patchArticle(article.id, { starred: !article.starred })} className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex ${article.starred ? 'text-amber-500' : 'text-slate-300'} hover:bg-amber-50 hover:text-amber-500`} aria-label={article.starred ? '取消收藏' : '收藏'}><Star size={16} className={article.starred ? 'fill-current' : ''} /></button></div>
          </article>)}</div> : <RssStateView
            state={selectedFeedState === 'ready' ? 'empty' : selectedFeedState}
            title={rssState.articles.length ? '没有符合条件的文章' : selectedFeedState === 'error' ? '订阅源暂时无法访问' : selectedFeedState === 'offline' ? '当前正在使用缓存' : '正在等待资讯'}
            description={rssState.articles.length ? '换个关键词或切换筛选条件。' : selectedFeedState === 'error' ? (selectedFeed?.error || '请稍后重试这个订阅源。') : selectedFeedState === 'offline' ? '网络恢复后可以刷新来源，已缓存的内容仍然可以阅读。' : '默认已经准备好每日热点、中文 AI 和 GitHub 热门项目，稍等片刻即可看到最新内容。'}
            onRetry={selectedFeed ? () => { void refreshFeed(selectedFeed); } : refreshAll}
          />}
          </RssArticleReader>
        </RssArticleList>
      </div>
    </section>
  );
};

export default RssReaderPage;

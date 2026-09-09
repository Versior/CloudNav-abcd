import { RSS_PRESET_VERSION_KEY, RSS_STATE_KEY } from '../constants/storageKeys.ts';
import type { RssArticle, RssFeed, RssState } from '../types.ts';

export const DEFAULT_RSS_FEEDS: RssFeed[] = [
  {
    id: 'preset-github',
    url: 'https://cdn.jsdelivr.net/gh/Hyraze/trending-collection@main/api/daily/all.xml',
    title: 'GitHub 热门项目',
    siteUrl: 'https://github.com/trending',
    preset: true,
    addedAt: 0,
  },
  {
    id: 'preset-qbitai',
    url: 'https://www.qbitai.com/feed',
    title: '中文 AI · 量子位',
    siteUrl: 'https://www.qbitai.com',
    preset: true,
    addedAt: 0,
  },
  {
    id: 'preset-jiqizhixin',
    url: 'https://decemberpei.cyou/rssbox/wechat-jiqizhixin.xml',
    title: '中文 AI · 机器之心',
    siteUrl: 'https://www.jiqizhixin.com',
    preset: true,
    addedAt: 0,
  },
  {
    id: 'preset-geekpark',
    url: 'https://www.geekpark.net/rss',
    title: '中文科技 · 极客公园',
    siteUrl: 'https://www.geekpark.net',
    preset: true,
    addedAt: 0,
  },
  {
    id: 'preset-ithome',
    url: 'https://www.ithome.com/rss/',
    title: '每日热点 · IT之家',
    siteUrl: 'https://www.ithome.com',
    preset: true,
    addedAt: 0,
  },
];

export const DEFAULT_RSS_STATE: RssState = { feeds: DEFAULT_RSS_FEEDS, articles: [] };
const RSS_PRESET_VERSION = 4;

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const normalizeRssState = (value: unknown): RssState => {
  const candidate = value && typeof value === 'object' ? value as Partial<RssState> : {};
  const sourceFeeds = Array.isArray(candidate.feeds) ? candidate.feeds : DEFAULT_RSS_FEEDS;
  const feeds = sourceFeeds.filter(item => !!item && typeof item === 'object' && typeof (item as RssFeed).url === 'string' && isHttpUrl((item as RssFeed).url))
    .slice(0, 50)
    .map((item, index) => {
      const feed = item as RssFeed;
      return {
        id: typeof feed.id === 'string' && feed.id ? feed.id : `feed-${index}-${feed.url}`,
        url: feed.url,
        title: typeof feed.title === 'string' && feed.title.trim() ? feed.title.trim().slice(0, 120) : feed.url,
        siteUrl: typeof feed.siteUrl === 'string' ? feed.siteUrl : undefined,
        icon: typeof feed.icon === 'string' ? feed.icon : undefined,
        preset: feed.preset === true,
        addedAt: Number.isFinite(feed.addedAt) ? feed.addedAt : Date.now(),
        lastFetchedAt: Number.isFinite(feed.lastFetchedAt) ? feed.lastFetchedAt : undefined,
        error: typeof feed.error === 'string' ? feed.error.slice(0, 160) : undefined,
      };
    });
  const seen = new Set<string>();
  const uniqueFeeds = feeds.filter(feed => {
    const key = feed.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const articles = (Array.isArray(candidate.articles) ? candidate.articles : [])
    .filter(item => !!item && typeof item === 'object' && typeof (item as RssArticle).id === 'string' && typeof (item as RssArticle).url === 'string')
    .slice(0, 300)
    .map(item => {
      const article = item as RssArticle;
      return {
        id: article.id,
        feedId: typeof article.feedId === 'string' ? article.feedId : '',
        title: typeof article.title === 'string' ? article.title.slice(0, 240) : article.url,
        url: article.url,
        summary: typeof article.summary === 'string' ? article.summary.slice(0, 360) : undefined,
        author: typeof article.author === 'string' ? article.author.slice(0, 120) : undefined,
        sourceTitle: typeof article.sourceTitle === 'string' ? article.sourceTitle.slice(0, 120) : undefined,
        publishedAt: Number.isFinite(article.publishedAt) ? article.publishedAt : undefined,
        imageUrl: typeof article.imageUrl === 'string' ? article.imageUrl : undefined,
        read: article.read === true,
        starred: article.starred === true,
      };
    });
  return { feeds: uniqueFeeds.length ? uniqueFeeds : DEFAULT_RSS_FEEDS, articles };
};

export const readRssState = (): RssState => {
  try {
    const raw = localStorage.getItem(RSS_STATE_KEY);
    const normalized = normalizeRssState(raw ? JSON.parse(raw) : DEFAULT_RSS_STATE);
    const presetVersion = Number(localStorage.getItem(RSS_PRESET_VERSION_KEY) || 0);
    if (presetVersion >= RSS_PRESET_VERSION) return normalized;
    const removedPresetIds = new Set(['preset-hot', 'preset-36kr', 'preset-juejin-ai', 'preset-github-blog', 'preset-github-changelog']);
    const migratedFeeds = normalized.feeds
      .filter(feed => !removedPresetIds.has(feed.id))
      .map(feed => feed.id === 'preset-github'
        ? {
            ...feed,
            url: DEFAULT_RSS_FEEDS.find(item => item.id === 'preset-github')?.url || feed.url,
            title: 'GitHub 热门项目',
            siteUrl: 'https://github.com/trending',
            error: undefined,
            lastFetchedAt: undefined,
          }
        : feed);
    const existingUrls = new Set(migratedFeeds.map(feed => feed.url.toLowerCase()));
    const missingPresets = DEFAULT_RSS_FEEDS.filter(feed => !existingUrls.has(feed.url.toLowerCase()));
    const migrated = { ...normalized, feeds: [...migratedFeeds, ...missingPresets].slice(0, 50) };
    localStorage.setItem(RSS_PRESET_VERSION_KEY, String(RSS_PRESET_VERSION));
    return migrated;
  } catch {
    return normalizeRssState(DEFAULT_RSS_STATE);
  }
};

export const writeRssState = (state: RssState) => {
  localStorage.setItem(RSS_STATE_KEY, JSON.stringify(normalizeRssState(state)));
  localStorage.setItem(RSS_PRESET_VERSION_KEY, String(RSS_PRESET_VERSION));
};

export interface RssFeedResponse {
  feed: Pick<RssFeed, 'id' | 'url' | 'title' | 'siteUrl' | 'icon'>;
  articles: RssArticle[];
  fetchedAt: number;
}

export const fetchRssFeed = async (url: string): Promise<RssFeedResponse> => {
  const response = await fetch(`/api/rss?url=${encodeURIComponent(url)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'RSS 获取失败');
  if (!payload || typeof payload !== 'object' || !payload.feed || typeof payload.feed !== 'object' || !Array.isArray(payload.articles)) {
    throw new Error('RSS 返回数据无效');
  }
  return payload as RssFeedResponse;
};

export const discoverRssFeeds = async (pageUrl: string): Promise<string[]> => {
  const response = await fetch(`/api/rss?discover=${encodeURIComponent(pageUrl)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'RSS 发现失败');
  return Array.isArray(payload?.feeds) ? payload.feeds.filter((value: unknown): value is string => typeof value === 'string') : [];
};

export const mergeRssArticles = (existing: RssArticle[], incoming: RssArticle[], feedId: string) => {
  const previous = new Map(existing.filter(article => article.feedId === feedId).map(article => [article.id, article]));
  const merged = incoming.map(article => ({
    ...article,
    feedId,
    read: previous.get(article.id)?.read === true,
    starred: previous.get(article.id)?.starred === true,
  }));
  const untouched = existing.filter(article => article.feedId !== feedId || !merged.some(next => next.id === article.id));
  return [...merged, ...untouched]
    .sort((left, right) => (right.publishedAt || 0) - (left.publishedAt || 0))
    .slice(0, 300);
};

export const formatRssTime = (timestamp?: number) => {
  if (!timestamp) return '时间未知';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '时间未知';
  const diff = Date.now() - date.getTime();
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / 60000))} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

export const parseOpml = (source: string) => [...source.matchAll(/<outline\b[^>]*>/gi)]
  .map(match => match[0])
  .map(markup => {
    const get = (name: string) => markup.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] || '';
    const url = get('xmlUrl');
    return url && isHttpUrl(url) ? { url, title: get('title') || get('text') || url } : null;
  })
  .filter((item): item is { url: string; title: string } => !!item);

export const buildOpml = (feeds: RssFeed[]) => `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0"><head><title>CloudNav RSS subscriptions</title></head><body>
${feeds.map(feed => `  <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.siteUrl || '')}" />`).join('\n')}
</body></opml>`;

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

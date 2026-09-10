import type { RssArticle, RssFeed } from '../types';

export interface ParsedRssFeed {
  feed: Pick<RssFeed, 'id' | 'url' | 'title' | 'siteUrl' | 'icon'>;
  articles: RssArticle[];
}

const MAX_ARTICLES = 30;
const HTML_TAG_RE = /<[^>]*>/g;

const decodeEntities = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
  .replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/gi, (_, entity: string) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ',
  }[entity.toLowerCase()] || `&${entity};`));

const stripCdata = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');

export const cleanFeedText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return decodeEntities(stripCdata(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(HTML_TAG_RE, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?，。；！？：])/g, '$1')
    .trim();
};

const getBlocks = (source: string, tag: string) => {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...source.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'gi'))]
    .map(match => match[1] || '');
};

const getTag = (source: string, tagNames: string[]) => {
  for (const tag of tagNames) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, 'i'));
    if (match?.[1]) return match[1];
  }
  return '';
};

const getAttribute = (tagMarkup: string, attribute: string) => {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = tagMarkup.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return decodeEntities(match?.[1] || match?.[2] || match?.[3] || '');
};

const getLinkTags = (source: string) => source.match(/<link\b[^>]*>/gi) || [];

const resolveHttpUrl = (value: string, baseUrl: string) => {
  if (!value.trim()) return '';
  try {
    const parsed = new URL(value.trim(), baseUrl);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const findDocumentLink = (source: string, baseUrl: string) => {
  const alternate = getLinkTags(source).find(markup => /rel\s*=\s*["'][^"']*alternate/i.test(markup));
  const candidate = alternate || getLinkTags(source)[0];
  const href = candidate ? getAttribute(candidate, 'href') : '';
  return resolveHttpUrl(href || cleanFeedText(getTag(source, ['link'])), baseUrl);
};

const findEntryLink = (source: string, baseUrl: string) => {
  const linkTags = getLinkTags(source);
  const alternate = linkTags.find(markup => /rel\s*=\s*["']alternate["']/i.test(markup));
  const candidate = alternate || linkTags[0];
  const href = candidate ? getAttribute(candidate, 'href') : '';
  return resolveHttpUrl(href || cleanFeedText(getTag(source, ['link'])), baseUrl);
};

const toTimestamp = (value: string) => {
  const timestamp = Date.parse(cleanFeedText(value));
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const trimSummary = (value: string) => value.length > 360 ? `${value.slice(0, 357).trimEnd()}...` : value;
const trimContent = (value: string) => value.length > 24000 ? `${value.slice(0, 23997).trimEnd()}...` : value;

const normalizeArticle = (article: Omit<RssArticle, 'id' | 'feedId'> & { identity?: string }, feed: ParsedRssFeed['feed'], index: number): RssArticle | null => {
  const title = cleanFeedText(article.title);
  const url = resolveHttpUrl(article.url, feed.url);
  if (!title || !url) return null;
  const identity = cleanFeedText(article.identity || url) || url;
  return {
    id: `${feed.id}#${identity}`,
    feedId: feed.id,
    title,
    url,
    summary: trimSummary(cleanFeedText(article.summary)),
    content: trimContent(cleanFeedText(article.content || article.summary)),
    author: cleanFeedText(article.author) || undefined,
    sourceTitle: cleanFeedText(feed.title) || undefined,
    publishedAt: article.publishedAt,
    imageUrl: resolveHttpUrl(article.imageUrl || '', feed.url) || undefined,
    read: false,
    starred: false,
  };
};

const parseJsonFeed = (source: string, sourceUrl: string): ParsedRssFeed | null => {
  let parsed: any;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) return null;
  const feed: ParsedRssFeed['feed'] = {
    id: sourceUrl,
    url: sourceUrl,
    title: cleanFeedText(parsed.title) || new URL(sourceUrl).hostname,
    siteUrl: resolveHttpUrl(String(parsed.home_page_url || ''), sourceUrl) || undefined,
    icon: resolveHttpUrl(String(parsed.icon || parsed.favicon || ''), sourceUrl) || undefined,
  };
  const articles = parsed.items.map((item: any, index: number) => normalizeArticle({
    title: item?.title,
    url: item?.url || item?.external_url,
    summary: item?.summary || item?.content_text || item?.content_html,
    content: item?.content_text || item?.content_html || item?.summary,
    author: item?.author?.name || item?.authors?.[0]?.name,
    publishedAt: toTimestamp(item?.date_published || item?.date_modified || ''),
    imageUrl: item?.image,
    identity: item?.id || item?.url,
  }, feed, index)).filter(Boolean).slice(0, MAX_ARTICLES) as RssArticle[];
  return { feed, articles };
};

const parseXmlFeed = (source: string, sourceUrl: string): ParsedRssFeed => {
  const channel = getBlocks(source, 'channel')[0] || source;
  const isAtom = /<feed\b/i.test(source) && !/<rss\b/i.test(source);
  const feed: ParsedRssFeed['feed'] = {
    id: sourceUrl,
    url: sourceUrl,
    title: cleanFeedText(getTag(isAtom ? source : channel, ['title'])) || new URL(sourceUrl).hostname,
    siteUrl: findDocumentLink(isAtom ? source : channel, sourceUrl) || undefined,
  };

  const blocks = isAtom ? getBlocks(source, 'entry') : getBlocks(channel, 'item');
  const articles = blocks.map((block, index) => {
    const enclosure = block.match(/<(?:enclosure|media:content)\b[^>]*>/i)?.[0] || '';
    const imageUrl = getAttribute(enclosure, 'url') || getAttribute(block.match(/<media:thumbnail\b[^>]*>/i)?.[0] || '', 'url');
    const link = isAtom ? findEntryLink(block, sourceUrl) : resolveHttpUrl(cleanFeedText(getTag(block, ['link'])), sourceUrl);
    const identity = cleanFeedText(getTag(block, isAtom ? ['id'] : ['guid'])) || link;
    return normalizeArticle({
      title: getTag(block, ['title']),
      url: link,
      summary: getTag(block, isAtom ? ['summary', 'content'] : ['description', 'content:encoded']),
      content: getTag(block, isAtom ? ['content', 'summary'] : ['content:encoded', 'description']),
      author: getTag(block, ['author', 'dc:creator']),
      publishedAt: toTimestamp(getTag(block, isAtom ? ['published', 'updated'] : ['pubDate', 'dc:date'])),
      imageUrl,
      identity,
    }, feed, index);
  }).filter(Boolean).slice(0, MAX_ARTICLES) as RssArticle[];
  return { feed, articles };
};

export const parseRssFeedText = (source: string, sourceUrl: string): ParsedRssFeed => {
  const normalizedUrl = new URL(sourceUrl).toString();
  const trimmed = source.trim();
  if (trimmed.startsWith('{')) {
    const json = parseJsonFeed(trimmed, normalizedUrl);
    if (json) return json;
  }
  return parseXmlFeed(trimmed, normalizedUrl);
};

export const discoverFeedUrls = (html: string, pageUrl: string) => {
  const urls: string[] = [];
  const add = (value: string) => {
    const resolved = resolveHttpUrl(value, pageUrl);
    if (resolved && !urls.includes(resolved)) urls.push(resolved);
  };

  for (const markup of html.match(/<link\b[^>]*>/gi) || []) {
    const type = getAttribute(markup, 'type').toLowerCase();
    const rel = getAttribute(markup, 'rel').toLowerCase();
    if (['application/rss+xml', 'application/atom+xml', 'application/feed+json', 'application/json'].includes(type) || (rel.includes('alternate') && /rss|atom|feed/i.test(markup))) {
      add(getAttribute(markup, 'href'));
    }
  }

  for (const path of ['/feed', '/feed.xml', '/rss.xml', '/atom.xml', '/index.xml']) add(path);
  return urls.slice(0, 10);
};

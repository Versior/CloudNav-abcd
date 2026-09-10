import type { GithubWatchItem, Inspiration, LinkItem, ReadLaterItem, RssArticle, UnifiedInboxItem } from '../types.ts';

interface InboxInput {
  links?: LinkItem[];
  articles?: RssArticle[];
  readLater?: ReadLaterItem[];
  inspirations?: Inspiration[];
  githubWatch?: GithubWatchItem[];
}

const recentCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

export const buildInboxItems = ({ links = [], articles = [], readLater = [], inspirations = [], githubWatch = [] }: InboxInput): UnifiedInboxItem[] => {
  const rss = articles
    .filter(article => !article.read || article.starred)
    .map(article => ({
      id: `rss:${article.id}`,
      kind: 'rss' as const,
      title: article.title,
      summary: article.aiSummary || article.summary || article.content,
      url: article.url,
      source: article.sourceTitle,
      updatedAt: article.publishedAt || 0,
      read: article.read === true,
      starred: article.starred === true,
    }));
  const websites = links
    .filter(link => !link.deletedAt && (link.pinned || (link.lastVisitedAt || 0) >= recentCutoff))
    .slice(0, 40)
    .map(link => ({
      id: `website:${link.id}`,
      kind: 'website' as const,
      title: link.title,
      summary: link.description || link.note,
      url: link.url,
      source: '网站库',
      updatedAt: link.lastVisitedAt || link.updatedAt || link.createdAt,
      read: link.status === 'read',
      starred: link.pinned === true || link.status === 'favorite',
    }));
  const queue = readLater
    .filter(item => item.status !== 'archived')
    .map(item => ({
      id: `read-later:${item.id}`,
      kind: 'read-later' as const,
      title: item.title,
      summary: item.summary,
      url: item.url,
      source: item.source || '稍后阅读',
      updatedAt: item.updatedAt,
      read: item.status === 'read',
      starred: false,
    }));
  const ideas = inspirations
    .filter(item => item.status === 'active')
    .map(item => ({
      id: `inspiration:${item.id}`,
      kind: 'inspiration' as const,
      title: item.title,
      summary: item.aiSummary || item.content,
      url: item.sourceUrl,
      source: item.sourceTitle || '灵感库',
      updatedAt: item.updatedAt,
      read: false,
      starred: true,
    }));
  const github = githubWatch
    .filter(item => !item.error && (!item.processedAt || (item.lastFetchedAt || 0) > item.processedAt))
    .map(item => ({
      id: `github:${item.id}`,
      kind: 'github' as const,
      title: `${item.owner}/${item.repo}`,
      summary: item.description,
      url: item.url,
      source: item.language ? `GitHub · ${item.language}` : 'GitHub 追踪',
      updatedAt: item.lastFetchedAt || 0,
      read: false,
      starred: false,
    }));
  const seen = new Set<string>();
  return [...rss, ...queue, ...ideas, ...github, ...websites]
    .filter(item => {
      const key = item.url || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 160);
};

export const getInboxKindLabel = (kind: UnifiedInboxItem['kind']) => ({
  rss: 'RSS',
  website: '网站',
  github: 'GitHub',
  inspiration: '灵感',
  'read-later': '稍后阅读',
}[kind]);

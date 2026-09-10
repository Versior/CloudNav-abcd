import type { GithubWatchItem, Inspiration, LinkItem, ReadLaterItem, ReadingDocument, RssArticle } from '../types.ts';

export type UnifiedSearchKind = 'link' | 'rss' | 'inspiration' | 'read-later' | 'github' | 'reading';
export interface UnifiedSearchResult { id: string; kind: UnifiedSearchKind; title: string; subtitle: string; url?: string; score: number; }
export interface UnifiedSearchInput { links?: LinkItem[]; articles?: RssArticle[]; inspirations?: Inspiration[]; readLater?: ReadLaterItem[]; githubWatch?: GithubWatchItem[]; readingDocuments?: ReadingDocument[]; }

const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';
const scoreText = (query: string, fields: string[]) => {
  const q = normalize(query);
  if (!q) return 0;
  const values = fields.map(normalize);
  if (!values.some(value => value.includes(q))) return -1;
  return values[0] === q ? 100 : values[0].startsWith(q) ? 80 : values.some(value => value.startsWith(q)) ? 60 : 30;
};

export const searchWorkspace = (query: string, input: UnifiedSearchInput, limit = 12): UnifiedSearchResult[] => {
  if (!normalize(query)) return [];
  const results: UnifiedSearchResult[] = [];
  (input.links || []).forEach(item => { const score = scoreText(query, [item.title, item.url, item.description || '', ...(item.tags || []), ...(item.aliases || [])]); if (score >= 0) results.push({ id: item.id, kind: 'link', title: item.title, subtitle: item.description || item.url, url: item.url, score }); });
  (input.articles || []).forEach(item => { const score = scoreText(query, [item.title, item.sourceTitle || '', item.summary || '', item.content || '', ...(item.aiTags || [])]); if (score >= 0) results.push({ id: item.id, kind: 'rss', title: item.title, subtitle: item.sourceTitle || 'RSS 资讯', url: item.url, score }); });
  (input.inspirations || []).forEach(item => { const score = scoreText(query, [item.title, item.content, item.sourceTitle || '', ...item.tags]); if (score >= 0) results.push({ id: item.id, kind: 'inspiration', title: item.title, subtitle: item.sourceTitle || '灵感库', url: item.sourceUrl, score }); });
  (input.readLater || []).forEach(item => { const score = scoreText(query, [item.title, item.source || '', item.summary || '', item.url]); if (score >= 0) results.push({ id: item.id, kind: 'read-later', title: item.title, subtitle: item.source || '稍后阅读', url: item.url, score }); });
  (input.githubWatch || []).forEach(item => { const score = scoreText(query, [`${item.owner}/${item.repo}`, item.description || '', item.language || '']); if (score >= 0) results.push({ id: item.id, kind: 'github', title: `${item.owner}/${item.repo}`, subtitle: item.description || 'GitHub 追踪', url: item.url, score }); });
  (input.readingDocuments || []).forEach(item => { const score = scoreText(query, [item.title, item.source || '', item.author || '', item.content || '', item.summary || '', item.note || '', ...item.tags, ...item.highlights.flatMap(highlight => [highlight.quote, highlight.note || '', ...highlight.tags])]); if (score >= 0) results.push({ id: item.id, kind: 'reading', title: item.title, subtitle: item.source || '阅读库', url: item.url, score: score + 5 }); });
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-CN')).slice(0, limit);
};

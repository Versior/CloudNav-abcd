import type { LinkItem } from '../types.ts';

export interface SearchIndexEntry {
  id: string;
  text: string;
  title: string;
  healthRank: number;
  pinned: boolean;
  visits: number;
}

export type SearchIndex = Map<string, SearchIndexEntry>;

const rankHealth = (link: LinkItem) => link.health?.status === 'ok' ? 3 : link.health?.status === 'redirected' ? 2 : link.health?.status === 'unknown' ? 1 : 0;

export const buildSearchIndex = (links: LinkItem[]): SearchIndex => new Map(links.filter(link => !link.deletedAt).map(link => [link.id, {
  id: link.id,
  text: [link.title, link.url, link.description, link.note, ...(link.tags || []), ...(link.aliases || []), ...(link.credentials || []).flatMap(item => [item.label, item.username, item.account, item.remark])].filter(Boolean).join(' ').toLowerCase(),
  title: link.title.toLowerCase(),
  healthRank: rankHealth(link),
  pinned: !!link.pinned,
  visits: link.visitCount || 0,
}]));

export const searchIndexedLinks = (index: SearchIndex, query: string): string[] => {
  const normalized = query.trim().toLowerCase();
  return [...index.values()].filter(entry => !normalized || entry.text.includes(normalized)).sort((left, right) => {
    const leftExact = left.title === normalized ? 1 : 0;
    const rightExact = right.title === normalized ? 1 : 0;
    if (leftExact !== rightExact) return rightExact - leftExact;
    if (left.healthRank !== right.healthRank) return right.healthRank - left.healthRank;
    if (left.pinned !== right.pinned) return Number(right.pinned) - Number(left.pinned);
    return right.visits - left.visits;
  }).map(entry => entry.id);
};

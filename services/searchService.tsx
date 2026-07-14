import React from 'react';
import { pinyin } from 'pinyin-pro';
import { LinkItem, Category } from '../types';

export interface ParsedQuery {
  tag?: string;
  cat?: string;
  visited?: number;
  text: string;
}

const getLinkSearchText = (link: LinkItem): string => {
  const credentialText = (link.credentials || [])
    .flatMap(c => [c.label, c.username, c.account, c.remark])
    .filter(Boolean)
    .join(' ');

  return [
    link.title,
    link.url,
    link.description,
    link.note,
    (link.tags || []).join(' '),
    credentialText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

export const parseSearchQuery = (query: string): ParsedQuery => {
  let text = query.trim().toLowerCase();
  let tag: string | undefined;
  let cat: string | undefined;
  let visited: number | undefined;

  const tagMatch = text.match(/\btag:(\S+)/);
  if (tagMatch) { tag = tagMatch[1]; text = text.replace(tagMatch[0], '').trim(); }

  const catMatch = text.match(/\bcat:(\S+)/);
  if (catMatch) { cat = catMatch[1]; text = text.replace(catMatch[0], '').trim(); }

  const visitedMatch = text.match(/\bvisited:(\d+)/);
  if (visitedMatch) { visited = parseInt(visitedMatch[1]); text = text.replace(visitedMatch[0], '').trim(); }

  return { tag, cat, visited, text };
};

export const matchesFilters = (link: LinkItem, parsed: ParsedQuery, categories: Category[]): boolean => {
  if (parsed.tag && !link.tags?.some(t => t.toLowerCase().includes(parsed.tag!))) return false;
  if (parsed.cat) {
    const matchedCategories = categories.filter(c => c.id.toLowerCase() === parsed.cat || c.name.toLowerCase().includes(parsed.cat!));
    const matchedIds = new Set(matchedCategories.flatMap(c => [c.id, ...categories.filter(child => child.parentId === c.id).map(child => child.id)]));
    if (!matchedIds.has(link.categoryId)) return false;
  }
  if (parsed.visited !== undefined) {
    if (!link.lastVisitedAt) return false;
    const cutoff = Date.now() - parsed.visited * 24 * 60 * 60 * 1000;
    if (link.lastVisitedAt < cutoff) return false;
  }
  return true;
};

export const matchesQuery = (link: LinkItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (getLinkSearchText(link).includes(q)) return true;
  try {
    const full = pinyin(link.title, { toneType: 'none', type: 'array' }).join('').toLowerCase();
    const first = pinyin(link.title, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
    return full.includes(q) || first.includes(q);
  } catch { return false; }
};

export const sortByRelevance = (links: LinkItem[], query: string): LinkItem[] => {
  return [...links].sort((a, b) => {
    const q = query.trim().toLowerCase();
    const aTitle = a.title.toLowerCase() === q ? 1 : 0;
    const bTitle = b.title.toLowerCase() === q ? 1 : 0;
    if (aTitle !== bTitle) return bTitle - aTitle;

    const aIncludesTitle = q && a.title.toLowerCase().includes(q) ? 1 : 0;
    const bIncludesTitle = q && b.title.toLowerCase().includes(q) ? 1 : 0;
    if (aIncludesTitle !== bIncludesTitle) return bIncludesTitle - aIncludesTitle;

    const aVisits = a.visitCount || 0;
    const bVisits = b.visitCount || 0;
    if (aVisits !== bVisits) return bVisits - aVisits;

    const aLast = a.lastVisitedAt || 0;
    const bLast = b.lastVisitedAt || 0;
    return bLast - aLast;
  });
};

export const highlightMatch = (text: string, query: string): React.ReactNode => {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 text-inherit rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
};

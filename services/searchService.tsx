import React from 'react';
import { pinyin } from 'pinyin-pro';
import { LinkItem, Category } from '../types';

// 搜索语法解析结果
export interface ParsedQuery {
  tag?: string;
  cat?: string;
  visited?: number;
  text: string;
}

// 解析搜索语法: tag:xxx cat:xxx visited:N 其余为文本
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

// 检查链接是否匹配搜索语法
export const matchesFilters = (link: LinkItem, parsed: ParsedQuery, categories: Category[]): boolean => {
  if (parsed.tag && !link.tags?.some(t => t.toLowerCase().includes(parsed.tag!))) return false;
  if (parsed.cat) {
    const cat = categories.find(c => c.name.toLowerCase().includes(parsed.cat!));
    if (!cat || link.categoryId !== cat.id) return false;
  }
  if (parsed.visited !== undefined) {
    if (!link.lastVisitedAt) return false;
    const cutoff = Date.now() - parsed.visited * 24 * 60 * 60 * 1000;
    if (link.lastVisitedAt < cutoff) return false;
  }
  return true;
};

// 搜索匹配:标题/URL/描述/标签/拼音
export const matchesQuery = (link: LinkItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (link.title.toLowerCase().includes(q) || link.url.toLowerCase().includes(q) || (link.description && link.description.toLowerCase().includes(q))) return true;
  if (link.tags?.some(t => t.toLowerCase().includes(q))) return true;
  try {
    const full = pinyin(link.title, { toneType: 'none', type: 'array' }).join('').toLowerCase();
    const first = pinyin(link.title, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
    return full.includes(q) || first.includes(q);
  } catch { return false; }
};

// 搜索排序（高频/最近靠前）
export const sortByRelevance = (links: LinkItem[], query: string): LinkItem[] => {
  return [...links].sort((a, b) => {
    // 精准标题匹配优先
    const q = query.trim().toLowerCase();
    const aTitle = a.title.toLowerCase() === q ? 1 : 0;
    const bTitle = b.title.toLowerCase() === q ? 1 : 0;
    if (aTitle !== bTitle) return bTitle - aTitle;

    // 访问频率
    const aVisits = a.visitCount || 0;
    const bVisits = b.visitCount || 0;
    if (aVisits !== bVisits) return bVisits - aVisits;

    // 最近访问
    const aLast = a.lastVisitedAt || 0;
    const bLast = b.lastVisitedAt || 0;
    return bLast - aLast;
  });
};

// 搜索时高亮标题里的匹配片段
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

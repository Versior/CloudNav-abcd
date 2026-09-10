import type { AIConfig, LinkItem } from '../types.ts';
import { fetchReadableDocument } from './contentService.ts';
import { summarizeWebsitePage, type RssSummaryResult } from './geminiService.ts';

const CACHE_KEY = 'cloudnav_website_ai_summary_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SOURCE_LENGTH = 18_000;

export interface WebsiteSummaryResult extends RssSummaryResult {
  title: string;
  url: string;
  fetchedAt: number;
  fromCache?: boolean;
}

export interface WebsiteSummaryLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

const normalizeUrl = (value: string) => {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
};

const isWebsiteSummaryResult = (value: unknown): value is WebsiteSummaryResult => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<WebsiteSummaryResult>;
  return typeof item.title === 'string'
    && typeof item.url === 'string'
    && typeof item.summary === 'string'
    && Array.isArray(item.bullets)
    && Array.isArray(item.tags)
    && Number.isFinite(item.fetchedAt);
};

const readCache = (): WebsiteSummaryResult[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isWebsiteSummaryResult).slice(0, 20) : [];
  } catch {
    return [];
  }
};

const writeCache = (entries: WebsiteSummaryResult[]) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    // 缓存不可用时不影响打开网站或生成摘要。
  }
};

export const buildWebsiteSummarySource = (
  document: { title: string; url: string; content?: string; summary?: string },
  fallbackDescription = '',
) => {
  const source = [document.content, document.summary, fallbackDescription]
    .map(value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '')
    .find(Boolean)
    ?.slice(0, MAX_SOURCE_LENGTH) || '';
  if (!source) throw new Error('页面没有可提取的正文内容');
  return source;
};

export const getCachedWebsiteSummary = (url: string): WebsiteSummaryResult | null => {
  const canonicalUrl = normalizeUrl(url);
  const cached = readCache().find(item => normalizeUrl(item.url) === canonicalUrl);
  if (!cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS) return null;
  return { ...cached, fromCache: true };
};

export const summarizeWebsite = async (
  link: WebsiteSummaryLink | LinkItem,
  config: AIConfig,
): Promise<WebsiteSummaryResult> => {
  const document = await fetchReadableDocument(link.url);
  const source = buildWebsiteSummarySource(document, link.description || '');
  const result = await summarizeWebsitePage({
    title: document.title || link.title,
    url: document.url || link.url,
    summary: source,
    sourceTitle: link.title,
  }, config);
  const next: WebsiteSummaryResult = {
    ...result,
    title: document.title || link.title,
    url: normalizeUrl(link.url),
    fetchedAt: Date.now(),
  };
  const remaining = readCache().filter(item => normalizeUrl(item.url) !== next.url);
  writeCache([next, ...remaining]);
  return next;
};

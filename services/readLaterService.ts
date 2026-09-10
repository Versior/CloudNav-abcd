import type { ReadLaterItem, ReadLaterKind, ReadLaterStatus } from '../types.ts';

const MAX_ITEMS = 500;
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validKind = (value: unknown): ReadLaterKind => value === 'website' || value === 'github' || value === 'inspiration' ? value : 'rss';
const validStatus = (value: unknown): ReadLaterStatus => value === 'read' || value === 'archived' ? value : 'unread';
const normalizeUrl = (value: unknown) => {
  const raw = clean(value, 2000);
  try { const url = new URL(raw); url.hash = ''; return url.toString(); } catch { return raw; }
};
const makeId = (url: string) => `later-${url || Date.now()}`;

export const normalizeReadLaterItem = (value: unknown): ReadLaterItem | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ReadLaterItem>;
  const url = normalizeUrl(item.url);
  const title = clean(item.title, 240);
  if (!url || !title) return null;
  const addedAt = Number.isFinite(item.addedAt) && Number(item.addedAt) > 0 ? Number(item.addedAt) : Date.now();
  return { id: clean(item.id, 220) || makeId(url), kind: validKind(item.kind), title, url, source: clean(item.source, 160) || undefined, summary: clean(item.summary, 600) || undefined, status: validStatus(item.status), addedAt, updatedAt: Number.isFinite(item.updatedAt) ? Number(item.updatedAt) : addedAt };
};

export const normalizeReadLater = (value: unknown): ReadLaterItem[] => {
  const result: ReadLaterItem[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(value) ? value : []) {
    const item = normalizeReadLaterItem(raw);
    if (!item || seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }
  return result.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ITEMS);
};

export const addReadLater = (items: ReadLaterItem[], input: Partial<ReadLaterItem>, now = Date.now()): ReadLaterItem[] => {
  const candidate = normalizeReadLaterItem({ ...input, id: undefined, addedAt: now, updatedAt: now, status: input.status || 'unread' });
  if (!candidate) throw new Error('稍后阅读需要有效标题和网址');
  const existing = items.find(item => item.url === candidate.url);
  const next = existing ? [existing, ...items.filter(item => item.id !== existing.id)] : [candidate, ...items];
  return normalizeReadLater(next);
};

export const updateReadLaterStatus = (items: ReadLaterItem[], itemId: string, status: ReadLaterStatus, now = Date.now()): ReadLaterItem[] => normalizeReadLater(items.map(item => item.id === itemId ? { ...item, status, updatedAt: now } : item));

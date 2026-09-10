import type { Inspiration, InspirationStatus, InspirationType } from '../types.ts';

const MAX_ITEMS = 500;
const MAX_TITLE = 160;
const MAX_CONTENT = 20000;
const MAX_TAGS = 12;

const text = (value: unknown, max: number) => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '';
const uniqueTags = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.map(item => text(item, 24)).filter(tag => {
    const key = tag.toLocaleLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_TAGS);
};
const validType = (value: unknown): InspirationType => value === 'note' || value === 'quote' || value === 'bookmark' ? value : 'idea';
const validStatus = (value: unknown): InspirationStatus => value === 'archived' ? 'archived' : 'active';
const validUrl = (value: unknown) => {
  const candidate = text(value, 2000);
  if (!candidate) return undefined;
  try { return new URL(candidate).toString(); } catch { return undefined; }
};
const id = () => `inspiration-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export const normalizeInspiration = (value: unknown): Inspiration | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<Inspiration>;
  const title = text(item.title, MAX_TITLE);
  const content = text(item.content, MAX_CONTENT);
  if (!title || !content) return null;
  const createdAt = Number.isFinite(item.createdAt) && Number(item.createdAt) > 0 ? Number(item.createdAt) : Date.now();
  const updatedAt = Number.isFinite(item.updatedAt) && Number(item.updatedAt) > 0 ? Number(item.updatedAt) : createdAt;
  const status = validStatus(item.status);
  return {
    id: text(item.id, 120) || id(),
    title,
    content,
    type: validType(item.type),
    tags: uniqueTags(item.tags),
    sourceUrl: validUrl(item.sourceUrl),
    sourceTitle: text(item.sourceTitle, 160) || undefined,
    status,
    createdAt,
    updatedAt,
    archivedAt: status === 'archived' && Number.isFinite(item.archivedAt) ? Number(item.archivedAt) : undefined,
    aiSummary: text(item.aiSummary, 1000) || undefined,
  };
};

export const normalizeInspirations = (value: unknown): Inspiration[] => {
  const items = Array.isArray(value) ? value.map(normalizeInspiration).filter((item): item is Inspiration => Boolean(item)) : [];
  return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_ITEMS);
};

export const createInspiration = (input: Partial<Inspiration>, now = Date.now()): Inspiration => {
  const normalized = normalizeInspiration({ ...input, id: id(), createdAt: now, updatedAt: now, status: input.status || 'active' });
  if (!normalized) throw new Error('灵感标题和内容不能为空');
  return normalized;
};

export const updateInspiration = (items: Inspiration[], itemId: string, patch: Partial<Inspiration>, now = Date.now()): Inspiration[] => {
  return normalizeInspirations(items.map(item => item.id === itemId ? { ...item, ...patch, id: item.id, updatedAt: now } : item));
};

export const removeInspiration = (items: Inspiration[], itemId: string): Inspiration[] => items.filter(item => item.id !== itemId);

export const filterInspirations = (items: Inspiration[], filters: { query?: string; tag?: string; status?: InspirationStatus }): Inspiration[] => {
  const query = text(filters.query, 120).toLocaleLowerCase();
  const tag = text(filters.tag, 24).toLocaleLowerCase();
  return normalizeInspirations(items).filter(item => {
    if (filters.status && item.status !== filters.status) return false;
    if (tag && !item.tags.some(value => value.toLocaleLowerCase() === tag)) return false;
    if (!query) return true;
    return [item.title, item.content, item.sourceTitle, ...item.tags].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
};

import type {
  ReadingDocument,
  ReadingDocumentStatus,
  ReadingDocumentType,
  ReadingHighlight,
  RssArticle,
} from '../types.ts';

export interface ReadingExportPayload {
  schemaVersion: 1;
  exportedAt: number;
  documents: ReadingDocument[];
}

export type ReadingDocumentInput = Partial<ReadingDocument> & Pick<ReadingDocument, 'title' | 'url'>;

const MAX_DOCUMENTS = 2000;
const MAX_CONTENT_LENGTH = 120_000;
const MAX_HIGHLIGHTS = 300;
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validType = (value: unknown): ReadingDocumentType => (
  value === 'rss' || value === 'website' || value === 'note' || value === 'pdf' || value === 'video' || value === 'github'
    ? value
    : 'article'
);
const validStatus = (value: unknown): ReadingDocumentStatus => value === 'later' || value === 'archive' ? value : 'inbox';

export const canonicalizeReadingUrl = (value: unknown) => {
  const raw = clean(value, 4000);
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
};

const normalizeTags = (value: unknown) => Array.from(new Set(
  (Array.isArray(value) ? value : [])
    .map(tag => clean(tag, 60))
    .filter(Boolean),
)).slice(0, 30);

export const normalizeReadingHighlight = (value: unknown, index = 0): ReadingHighlight | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ReadingHighlight>;
  const quote = clean(source.quote, 2000);
  if (!quote) return null;
  const createdAt = Number.isFinite(source.createdAt) ? Number(source.createdAt) : Date.now();
  return {
    id: clean(source.id, 180) || `highlight-${createdAt}-${index}`,
    quote,
    note: clean(source.note, 2000) || undefined,
    tags: normalizeTags(source.tags),
    start: Number.isFinite(source.start) ? Math.max(0, Number(source.start)) : undefined,
    end: Number.isFinite(source.end) ? Math.max(0, Number(source.end)) : undefined,
    createdAt,
    updatedAt: Number.isFinite(source.updatedAt) ? Number(source.updatedAt) : createdAt,
  };
};

export const normalizeReadingDocument = (value: unknown): ReadingDocument | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<ReadingDocument>;
  const title = clean(source.title, 240);
  const url = canonicalizeReadingUrl(source.url);
  if (!title || !url) return null;
  const createdAt = Number.isFinite(source.createdAt) ? Number(source.createdAt) : Date.now();
  const highlights = (Array.isArray(source.highlights) ? source.highlights : [])
    .map((item, index) => normalizeReadingHighlight(item, index))
    .filter((item): item is ReadingHighlight => !!item)
    .slice(0, MAX_HIGHLIGHTS);
  const rawProgress = Number.isFinite(source.progress) ? Number(source.progress) : 0;
  return {
    id: clean(source.id, 220) || `reading-${url}`,
    title,
    url,
    type: validType(source.type),
    status: validStatus(source.status),
    unread: source.unread !== false && source.status !== 'archive',
    starred: source.starred === true,
    tags: normalizeTags(source.tags),
    content: clean(source.content, MAX_CONTENT_LENGTH) || undefined,
    summary: clean(source.summary, 4000) || undefined,
    author: clean(source.author, 160) || undefined,
    source: clean(source.source, 180) || undefined,
    imageUrl: clean(source.imageUrl, 4000) || undefined,
    feedId: clean(source.feedId, 220) || undefined,
    note: clean(source.note, 4000) || undefined,
    highlights,
    progress: Math.min(1, Math.max(0, rawProgress)),
    readingPosition: Number.isFinite(source.readingPosition) ? Math.max(0, Number(source.readingPosition)) : 0,
    createdAt,
    updatedAt: Number.isFinite(source.updatedAt) ? Number(source.updatedAt) : createdAt,
    deletedAt: Number.isFinite(source.deletedAt) ? Number(source.deletedAt) : undefined,
    publishedAt: Number.isFinite(source.publishedAt) ? Number(source.publishedAt) : undefined,
    aiSummary: clean(source.aiSummary, 4000) || undefined,
  };
};

export const normalizeReadingDocuments = (value: unknown): ReadingDocument[] => {
  const result: ReadingDocument[] = [];
  const byUrl = new Map<string, ReadingDocument>();
  for (const raw of Array.isArray(value) ? value : []) {
    const document = normalizeReadingDocument(raw);
    if (!document) continue;
    const existing = byUrl.get(document.url);
    if (existing) {
      byUrl.set(document.url, {
        ...existing,
        ...document,
        highlights: document.highlights.length ? document.highlights : existing.highlights,
      });
    } else {
      byUrl.set(document.url, document);
    }
  }
  result.push(...byUrl.values());
  return result.sort((left, right) => right.updatedAt - left.updatedAt).slice(0, MAX_DOCUMENTS);
};

export const readingDocumentFromRss = (article: RssArticle): ReadingDocumentInput => ({
  id: `rss:${article.id}`,
  title: article.title,
  url: article.url,
  type: 'rss',
  status: article.read ? 'archive' : 'inbox',
  unread: !article.read,
  starred: article.starred === true,
  content: article.content || article.summary,
  summary: article.summary,
  author: article.author,
  source: article.sourceTitle,
  imageUrl: article.imageUrl,
  feedId: article.feedId,
  publishedAt: article.publishedAt,
  tags: article.aiTags || [],
  aiSummary: article.aiSummary,
});

export const upsertReadingDocument = (documents: ReadingDocument[], input: ReadingDocumentInput, now = Date.now()) => {
  const url = canonicalizeReadingUrl(input.url);
  const existing = documents.find(document => document.url === url);
  const next = normalizeReadingDocument({
    ...existing,
    ...input,
    id: existing?.id || input.id,
    url,
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
    highlights: input.highlights ?? existing?.highlights ?? [],
    tags: input.tags ?? existing?.tags ?? [],
  });
  if (!next) throw new Error('阅读内容需要有效标题和网址');
  return normalizeReadingDocuments([next, ...documents.filter(document => document.id !== existing?.id && document.url !== url)]);
};

export const transitionReadingDocument = (
  documents: ReadingDocument[],
  id: string,
  status: ReadingDocumentStatus,
  progress?: { progress?: number; position?: number },
  now = Date.now(),
) => normalizeReadingDocuments(documents.map(document => document.id === id ? {
  ...document,
  status,
  unread: false,
  progress: progress?.progress === undefined ? document.progress : Math.min(1, Math.max(0, progress.progress)),
  readingPosition: progress?.position === undefined ? document.readingPosition : Math.max(0, progress.position),
  updatedAt: now,
} : document));

export const toggleReadingStar = (documents: ReadingDocument[], id: string, now = Date.now()) => normalizeReadingDocuments(documents.map(document => document.id === id ? { ...document, starred: !document.starred, updatedAt: now } : document));

export const addReadingHighlight = (documents: ReadingDocument[], id: string, quote: string, note?: string, now = Date.now(), start?: number, end?: number) => normalizeReadingDocuments(documents.map(document => {
  if (document.id !== id) return document;
  const normalizedQuote = clean(quote, 2000);
  if (!normalizedQuote) return document;
  const existing = document.highlights.find(item => item.quote === normalizedQuote);
  const highlight: ReadingHighlight = existing || {
    id: `${document.id}:highlight:${now}:${document.highlights.length}`,
    quote: normalizedQuote,
    note: clean(note, 2000) || undefined,
    tags: [],
    start,
    end,
    createdAt: now,
    updatedAt: now,
  };
  return { ...document, highlights: existing ? document.highlights : [highlight, ...document.highlights].slice(0, MAX_HIGHLIGHTS), updatedAt: now };
}));

const parseQuery = (query: string) => {
  const terms: string[] = [];
  const filters: Record<string, string> = {};
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const separator = token.indexOf(':');
    if (separator > 0) filters[token.slice(0, separator).toLowerCase()] = token.slice(separator + 1).toLowerCase();
    else terms.push(token.toLowerCase());
  }
  return { terms, filters };
};

export const searchReadingDocuments = (query: string, documents: ReadingDocument[], limit = 100) => {
  const { terms, filters } = parseQuery(query);
  return documents
    .filter(document => {
      if (filters.status && document.status !== filters.status) return false;
      if (filters.type && document.type !== filters.type) return false;
      if (filters.tag && !document.tags.some(tag => tag.toLowerCase() === filters.tag)) return false;
      if (filters.source && !(document.source || '').toLowerCase().includes(filters.source)) return false;
      if (filters.has === 'highlight' && document.highlights.length === 0) return false;
      if (filters.has === 'note' && !document.note && document.highlights.every(item => !item.note)) return false;
      const searchable = [document.title, document.url, document.content, document.summary, document.author, document.source, document.note, ...document.tags, ...document.highlights.flatMap(item => [item.quote, item.note || '', ...item.tags])]
        .filter(Boolean).join(' ').toLowerCase();
      return terms.every(term => searchable.includes(term));
    })
    .map(document => {
      const searchable = [document.title, document.source, document.author, document.content, document.summary, document.note, ...document.tags].filter(Boolean).join(' ').toLowerCase();
      const score = terms.reduce((total, term) => total + (document.title.toLowerCase().includes(term) ? 30 : searchable.includes(term) ? 10 : 0), 0);
      return { document, score };
    })
    .sort((left, right) => right.score - left.score || right.document.updatedAt - left.document.updatedAt)
    .slice(0, limit)
    .map(item => item.document);
};

export const createReadingExport = (documents: ReadingDocument[], exportedAt = Date.now()): ReadingExportPayload => ({ schemaVersion: 1, exportedAt, documents: normalizeReadingDocuments(documents) });

export const parseReadingExport = (value: unknown): ReadingExportPayload => {
  const source = typeof value === 'string' ? JSON.parse(value) : value;
  if (!source || typeof source !== 'object' || (source as Partial<ReadingExportPayload>).schemaVersion !== 1) throw new Error('阅读库备份格式无效');
  return { schemaVersion: 1, exportedAt: Number.isFinite((source as ReadingExportPayload).exportedAt) ? Number((source as ReadingExportPayload).exportedAt) : Date.now(), documents: normalizeReadingDocuments((source as ReadingExportPayload).documents) };
};

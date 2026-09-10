import type { ReadingDocumentInput } from './readingWorkspace.ts';
import { cleanFeedText } from './rssParser.ts';

const stripUnsafeBlocks = (html: string) => html
  .replace(/<(script|style|noscript|template|svg|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, ' ')
  .replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ');

const getMeta = (html: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i'))
      || html.match(new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:name|property)\\s*=\\s*["']${escaped}["'][^>]*>`, 'i'));
    if (match?.[1]) return cleanFeedText(match[1]);
  }
  return '';
};

const getTagText = (html: string, tag: string) => cleanFeedText(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'))?.[1] || '');

const getReadableFragment = (html: string) => {
  const cleaned = stripUnsafeBlocks(html);
  const article = cleaned.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1\s*>/i)?.[2];
  return article || cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || cleaned;
};

const extractParagraphs = (fragment: string) => {
  const blocks = [...fragment.matchAll(/<(p|h[1-6]|li|blockquote|pre)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)]
    .map(match => cleanFeedText(match[2] || ''))
    .filter(Boolean);
  if (blocks.length > 0) return Array.from(new Set(blocks)).join('\n\n');
  return cleanFeedText(fragment);
};

export const extractReadableDocument = (html: string, sourceUrl: string): ReadingDocumentInput => {
  let url = sourceUrl.trim();
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    url = parsed.toString();
  } catch {}
  const fragment = getReadableFragment(html);
  const content = extractParagraphs(fragment).slice(0, 120_000);
  const title = getMeta(html, ['og:title', 'twitter:title']) || getTagText(html, 'title') || getTagText(fragment, 'h1') || url;
  const summary = getMeta(html, ['description', 'og:description', 'twitter:description']);
  const author = getMeta(html, ['author', 'article:author']);
  return {
    title: title.slice(0, 240),
    url,
    type: 'article',
    content: content || undefined,
    summary: summary || undefined,
    author: author || undefined,
    tags: [],
    highlights: [],
    progress: 0,
    readingPosition: 0,
    unread: true,
    starred: false,
    status: 'inbox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

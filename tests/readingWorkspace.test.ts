import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addReadingHighlight,
  createReadingExport,
  normalizeReadingDocuments,
  normalizeReadingDocument,
  parseReadingExport,
  searchReadingDocuments,
  transitionReadingDocument,
  upsertReadingDocument,
} from '../services/readingWorkspace.ts';
import { normalizeWorkspaceSnapshot } from '../services/workspaceSnapshot.ts';

const base = {
  id: 'doc-1',
  title: '  CloudNav Reader  ',
  url: 'https://example.com/story#comments',
  content: '正文内容，包含桌面阅读、批注和离线同步。',
  status: 'inbox' as const,
  type: 'article' as const,
  tags: ['阅读', '阅读', ''],
  highlights: [],
  starred: false,
  unread: true,
  createdAt: 100,
  updatedAt: 100,
};

test('normalizes documents without losing readable content', () => {
  const document = normalizeReadingDocument(base);
  assert.ok(document);
  assert.equal(document?.title, 'CloudNav Reader');
  assert.equal(document?.url, 'https://example.com/story');
  assert.deepEqual(document?.tags, ['阅读']);
  assert.equal(document?.status, 'inbox');
});

test('upsert is idempotent by canonical URL and preserves annotations', () => {
  const first = normalizeReadingDocument(base)!;
  const withHighlight = addReadingHighlight([first], first.id, '重要句子', '记住这个结论', 200)[0];
  const merged = upsertReadingDocument([withHighlight], {
    title: 'Updated title',
    url: 'https://example.com/story#new',
    content: 'Updated content',
    type: 'article',
    status: 'inbox',
    tags: ['new'],
  }, 300);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Updated title');
  assert.equal(merged[0].content, 'Updated content');
  assert.equal(merged[0].highlights.length, 1);
  assert.deepEqual(merged[0].tags, ['new']);
});

test('transitions status, unread state, and reading progress immutably', () => {
  const document = normalizeReadingDocument(base)!;
  const next = transitionReadingDocument([document], document.id, 'later', { progress: 0.42, position: 120 }, 400);
  assert.equal(next[0].status, 'later');
  assert.equal(next[0].unread, false);
  assert.equal(next[0].progress, 0.42);
  assert.equal(next[0].readingPosition, 120);
  assert.equal(document.status, 'inbox');
});

test('searches content and supports status, tag, and highlight filters', () => {
  const documents = normalizeReadingDocuments([
    base,
    { ...base, id: 'doc-2', title: '另一个文档', url: 'https://example.com/two', tags: ['产品'], content: '产品策略', status: 'later' },
  ]);
  const withHighlight = addReadingHighlight(documents, 'doc-2', '产品策略', undefined, 500);
  assert.deepEqual(searchReadingDocuments('产品 status:later has:highlight', withHighlight).map(item => item.id), ['doc-2']);
  assert.deepEqual(searchReadingDocuments('桌面', withHighlight).map(item => item.id), ['doc-1']);
});

test('exports and imports a versioned reading payload', () => {
  const documents = normalizeReadingDocuments([base]);
  const exported = createReadingExport(documents, 600);
  const parsed = parseReadingExport(exported);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.documents[0].url, 'https://example.com/story');
  assert.equal(parsed.exportedAt, 600);
});

test('workspace snapshots include reading documents for cross-device sync', () => {
  const snapshot = normalizeWorkspaceSnapshot({
    readingDocuments: [{
      id: 'doc-1', title: '同步文章', url: 'https://example.com/sync', type: 'article', status: 'later',
      unread: true, starred: false, tags: [], content: '正文', highlights: [], progress: 0,
      readingPosition: 0, createdAt: 1, updatedAt: 1,
    }],
  });
  assert.equal(snapshot.readingDocuments?.[0].title, '同步文章');
});

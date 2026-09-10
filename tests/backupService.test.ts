import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupEnvelope, sanitizeBackupData } from '../services/backupService.ts';

test('creates versioned backup metadata and removes raw AI credentials', () => {
  const backup = createBackupEnvelope({
    links: [{ id: '1', title: 'A', url: 'https://a.test', categoryId: 'common', createdAt: 1, credentials: [{ id: 'c', passwordCipher: 'secret', updatedAt: 1 }] }],
    categories: [{ id: 'common', name: 'Common', icon: 'Star' }],
    aiConfig: { provider: 'openai' as const, apiKey: 'secret', baseUrl: '', model: 'x' },
  }, 4, 100);
  assert.equal(backup.schemaVersion, 2);
  assert.deepEqual(backup.metadata, { createdAt: 100, version: 4, linkCount: 1, categoryCount: 1 });
  assert.equal(backup.aiConfig?.apiKey, '');
  assert.equal(backup.links[0].credentials?.[0].passwordCipher, 'secret');
});

test('sanitizes optional backup configs without changing the source object', () => {
  const source = { links: [], categories: [], aiConfig: { provider: 'gemini' as const, apiKey: 'secret', baseUrl: '', model: 'x' } };
  const result = sanitizeBackupData(source);
  assert.equal(result.aiConfig?.apiKey, '');
  assert.equal(source.aiConfig.apiKey, 'secret');
});

test('persists normalized workbench tools in backup envelopes', () => {
  const backup = createBackupEnvelope({
    links: [],
    categories: [],
    workbenchTools: {
      todos: [{ id: 'todo-1', text: '  ship  ', done: true }, { id: 'todo-2', text: '', done: false }],
      note: 'quick note',
      markdown: '# Today',
      weather: { temperature: 22, windSpeed: 3, updatedAt: 100, label: '上海' },
    },
  });
  assert.deepEqual(backup.workbenchTools?.todos, [{ id: 'todo-1', text: 'ship', done: true }]);
  assert.equal(backup.workbenchTools?.note, '');
  assert.equal(backup.workbenchTools?.markdown, '');
  assert.equal(backup.workbenchTools?.weather?.label, '上海');
});

test('backs up reading documents with content and annotations', () => {
  const backup = createBackupEnvelope({
    links: [],
    categories: [],
    readingDocuments: [{
      id: 'doc-1',
      title: 'Reader',
      url: 'https://example.com/story#part',
      type: 'article',
      status: 'later',
      unread: false,
      starred: true,
      tags: ['research'],
      content: 'Full text',
      highlights: [{ id: 'h-1', quote: 'Important', tags: [], createdAt: 1, updatedAt: 1 }],
      progress: 0.5,
      readingPosition: 20,
      createdAt: 1,
      updatedAt: 2,
    }],
  });
  assert.equal(backup.readingDocuments?.[0].url, 'https://example.com/story');
  assert.equal(backup.readingDocuments?.[0].highlights[0].quote, 'Important');
});

test('keeps RSS content and reading state in the backup payload', () => {
  const backup = createBackupEnvelope({
    links: [],
    categories: [],
    rssState: {
      feeds: [{ id: 'feed-1', url: 'https://example.com/rss', title: 'Example', addedAt: 1 }],
      articles: [{ id: 'article-1', feedId: 'feed-1', title: 'Story', url: 'https://example.com/story#top', content: 'Full story', read: true, starred: true }],
    },
  });
  assert.equal(backup.rssState?.articles[0].url, 'https://example.com/story#top');
  assert.equal(backup.rssState?.articles[0].content, 'Full story');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInspiration,
  normalizeInspirations,
  updateInspiration,
  removeInspiration,
  filterInspirations,
} from '../services/inspirationService.ts';
import {
  addReadLater,
  normalizeReadLater,
  updateReadLaterStatus,
} from '../services/readLaterService.ts';
import { fetchGithubRepository, parseGithubRepositoryUrl, normalizeGithubWatchItem } from '../services/githubService.ts';
import { createBackupEnvelope } from '../services/backupService.ts';
import { searchWorkspace } from '../services/unifiedSearch.ts';

test('inspiration service normalizes, creates and filters local-first notes', () => {
  const now = 1700000000000;
  const created = createInspiration({
    title: '  研究 RSS 解析  ',
    content: '记录一个可复用的解析策略',
    type: 'idea',
    tags: ['RSS', ' rss ', '工具'],
    sourceUrl: 'https://example.com/article',
  }, now);

  assert.equal(created.title, '研究 RSS 解析');
  assert.deepEqual(created.tags, ['RSS', '工具']);
  assert.equal(created.status, 'active');
  assert.equal(created.createdAt, now);

  const updated = updateInspiration([created], created.id, { status: 'archived', title: 'RSS 解析方案' }, now + 10);
  assert.equal(updated[0].status, 'archived');
  assert.equal(updated[0].updatedAt, now + 10);
  assert.equal(filterInspirations(updated, { query: '解析', status: 'archived' }).length, 1);
  assert.equal(removeInspiration(updated, created.id)[0], undefined);
});

test('inspiration and read-later normalization rejects malformed data and deduplicates urls', () => {
  const normalized = normalizeInspirations([{ id: 'x', title: 'ok', content: 'text', type: 'quote', tags: ['a', 'a'], createdAt: 1 }]);
  assert.equal(normalized.length, 1);
  assert.deepEqual(normalized[0].tags, ['a']);
  assert.deepEqual(normalizeInspirations([{ id: '', title: '', content: '', createdAt: 0 }]), []);

  const first = addReadLater([], { kind: 'rss', title: '文章', url: 'https://example.com/a', source: '源' }, 10);
  const same = addReadLater(first, { kind: 'website', title: '同一个地址', url: 'https://example.com/a#section', source: '网站' }, 20);
  assert.equal(same.length, 1);
  assert.equal(same[0].title, '文章');
  assert.equal(updateReadLaterStatus(same, same[0].id, 'archived')[0].status, 'archived');
  assert.equal(normalizeReadLater([{ ...same[0], status: 'bad' } as any])[0].status, 'unread');
});

test('github service parses repository urls and keeps safe metadata boundaries', () => {
  assert.deepEqual(parseGithubRepositoryUrl('https://github.com/owner/repo'), { owner: 'owner', repo: 'repo' });
  assert.deepEqual(parseGithubRepositoryUrl('github.com/owner/repo/'), { owner: 'owner', repo: 'repo' });
  assert.equal(parseGithubRepositoryUrl('https://github.com/owner'), null);
  const item = normalizeGithubWatchItem({ id: 'g1', owner: 'owner', repo: 'repo', url: 'https://github.com/owner/repo', stars: -3, description: 'x'.repeat(1000) }, 20);
  assert.equal(item.stars, 0);
  assert.equal(item.description?.length, 280);
  assert.equal(item.lastFetchedAt, 20);
});

test('github metadata falls back to the public API when the Cloudflare proxy is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async input => {
    const url = typeof input === 'string' ? input : input.url;
    requested.push(url);
    if (url.startsWith('/api/github?')) return new Response('<html>502 Bad Gateway</html>', { status: 502 });
    return new Response(JSON.stringify({
      html_url: 'https://github.com/owner/repo',
      description: 'repo description',
      stargazers_count: 42,
      language: 'TypeScript',
      pushed_at: '2026-09-10T00:00:00Z',
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const result = await fetchGithubRepository('owner', 'repo');
    assert.equal(result.description, 'repo description');
    assert.equal(result.stars, 42);
    assert.ok(requested.some(url => url === 'https://api.github.com/repos/owner/repo'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('backup envelope keeps personal workspace data while normalizing it', () => {
  const backup = createBackupEnvelope({
    links: [],
    categories: [],
    inspirations: [{ id: 'i1', title: '灵感', content: '内容', type: 'idea', tags: ['产品'], status: 'active', createdAt: 1, updatedAt: 1 }],
    readLater: [{ id: 'r1', kind: 'rss', title: '文章', url: 'https://example.com/a', status: 'unread', addedAt: 1, updatedAt: 1 }],
    githubWatch: [{ id: 'g1', owner: 'owner', repo: 'repo', url: 'https://github.com/owner/repo' }],
  });
  assert.equal(backup.inspirations?.[0].title, '灵感');
  assert.equal(backup.readLater?.[0].url, 'https://example.com/a');
  assert.equal(backup.githubWatch?.[0].url, 'https://github.com/owner/repo');
});

test('unified search ranks and returns links, RSS, inspirations, read-later and GitHub together', () => {
  const results = searchWorkspace('cloud', {
    links: [{ id: 'l1', title: 'CloudNav', url: 'https://example.com/cloud', categoryId: 'common', createdAt: 1 }],
    articles: [{ id: 'a1', feedId: 'f1', title: 'Cloud 原生资讯', url: 'https://example.com/rss', sourceTitle: 'RSS' }],
    inspirations: [{ id: 'i1', title: 'CloudNav 灵感', content: '记录', type: 'idea', tags: [], status: 'active', createdAt: 1, updatedAt: 1 }],
    readLater: [{ id: 'r1', kind: 'website', title: 'Cloud 文章', url: 'https://example.com/later', status: 'unread', addedAt: 1, updatedAt: 1 }],
    githubWatch: [{ id: 'g1', owner: 'cloud', repo: 'nav', url: 'https://github.com/cloud/nav' }],
  });
  assert.equal(results.length, 5);
  assert.deepEqual(new Set(results.map(item => item.kind)), new Set(['link', 'rss', 'inspiration', 'read-later', 'github']));
});

test('unified search includes full reading content and annotations', () => {
  const results = searchWorkspace('annotation', {
    readingDocuments: [{
      id: 'doc-1', title: 'Reader', url: 'https://example.com/reader', type: 'article', status: 'later', unread: false, starred: false,
      tags: [], content: 'The annotation is searchable', highlights: [{ id: 'h', quote: 'annotation', tags: [], createdAt: 1, updatedAt: 1 }],
      progress: 0, readingPosition: 0, createdAt: 1, updatedAt: 1,
    }],
  });
  assert.equal(results[0].kind, 'reading');
  assert.equal(results[0].id, 'doc-1');
});

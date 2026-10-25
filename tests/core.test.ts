import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAppData } from '../services/dataNormalization.ts';
import { normalizeOpenAIEndpoint } from '../services/openaiEndpoint.ts';
import { isBlockedHost } from '../functions/_shared/hostGuard.ts';
import {
  LATEST_BACKUP_KEY,
  normalizeData,
  persistData,
  writeLatestBackup,
} from '../functions/_shared/dataStore.ts';

test('normalizes legacy links without losing ordinary fields', () => {
  const data = normalizeAppData({
    categories: [
      { id: 'tools', name: '工具', icon: 'Wrench' },
      { id: 'tools', name: '重复分类' },
    ],
    links: [
      {
        id: '1',
        title: 'Example',
        url: 'https://example.com',
        categoryId: '__inbox__',
        note: 'keep me',
        credentials: { username: 'drop' },
        health: { status: 'broken' },
      },
      { id: '1', title: 'duplicate', url: 'https://duplicate.example' },
      { id: 'invalid', title: 'missing url' },
    ],
    version: 4.8,
  });

  assert.equal(data.version, 4);
  assert.deepEqual(data.categories.map(category => category.id), ['common', 'tools']);
  assert.equal(data.links.length, 1);
  assert.equal(data.links[0].categoryId, 'common');
  assert.equal(data.links[0].note, 'keep me');
  assert.equal('credentials' in data.links[0], false);
  assert.equal('health' in data.links[0], false);
});

test('normalizes OpenAI-compatible endpoints and rejects webpage URLs', () => {
  assert.equal(
    normalizeOpenAIEndpoint('https://api.openai.com/v1'),
    'https://api.openai.com/v1/chat/completions',
  );
  assert.equal(
    normalizeOpenAIEndpoint('https://api.deepseek.com'),
    'https://api.deepseek.com/chat/completions',
  );
  assert.throws(() => normalizeOpenAIEndpoint('https://chat.openai.com'), /网页地址/);
  assert.throws(() => normalizeOpenAIEndpoint(''), /不能为空/);
});

test('drops retired categories together with their links', () => {
  const data = normalizeAppData({
    categories: [
      { id: 'common', name: '常用推荐', icon: 'Star' },
      { id: 'sub-search', name: '搜索引擎', icon: 'Search', parentId: 'common' },
      { id: 'sub-news', name: '即时资讯', icon: 'Newspaper', parentId: 'common' },
      { id: 'dev', name: '开发工具', icon: 'Code' },
      { id: 'design', name: '设计资源', icon: 'Palette' },
      { id: 'ent', name: '休闲娱乐', icon: 'Gamepad2' },
      { id: 'ai', name: '人工智能', icon: 'Bot' },
      { id: 'mine', name: '我自建的分类', icon: 'Folder' },
    ],
    links: [
      { id: 'a', title: 'Google', url: 'https://google.com', categoryId: 'sub-search' },
      { id: 'b', title: '百度', url: 'https://baidu.com', categoryId: 'sub-search' },
      { id: 'c', title: 'IT之家', url: 'https://ithome.com', categoryId: 'sub-news' },
      { id: 'd', title: 'GitHub', url: 'https://github.com', categoryId: 'dev' },
      { id: 'e', title: 'Dribbble', url: 'https://dribbble.com', categoryId: 'design' },
      { id: 'f', title: 'Steam', url: 'https://store.steampowered.com', categoryId: 'ent' },
      { id: 'g', title: 'ChatGPT', url: 'https://chat.openai.com', categoryId: 'ai' },
      { id: 'h', title: '我的书签', url: 'https://example.com', categoryId: 'mine' },
    ],
  });

  // 旧默认示例分类连同链接一起清掉，用户自建分类与链接保留
  assert.deepEqual(data.categories.map(category => category.id), ['common', 'mine']);
  assert.deepEqual(data.links.map(link => link.id), ['h']);
});

class MemoryKv {
  private values = new Map<string, string>();

  async get(key: string) {
    return this.values.get(key) || null;
  }

  async put(key: string, value: string) {
    this.values.set(key, value);
  }

  async delete(key: string) {
    this.values.delete(key);
  }

  async list() {
    return { objects: [] };
  }
}

class MemoryR2 {
  puts: Array<{ key: string; value: string; metadata?: Record<string, string> }> = [];
  private objects = new Map<string, { value: string; metadata?: Record<string, string> }>();

  async head(key: string) {
    const object = this.objects.get(key);
    return object ? { customMetadata: object.metadata } : null;
  }

  async get() {
    return null;
  }

  async put(key: string, value: string, options?: { customMetadata?: Record<string, string> }) {
    this.objects.set(key, { value, metadata: options?.customMetadata });
    this.puts.push({ key, value, metadata: options?.customMetadata });
  }

  async delete() {}

  async list() {
    return { objects: [] };
  }
}

test('persists versions, detects conflicts, and skips unchanged content', async () => {
  const kv = new MemoryKv();
  const env = { NAVIX_KV: kv };
  const initial = { links: [], categories: [] };
  const first = await persistData(env, initial, 0);
  assert.equal(first.conflict, false);
  assert.equal(first.changed, false);

  const changed = await persistData(env, {
    links: [{ id: '1', title: 'Example', url: 'https://example.com', categoryId: 'common' }],
    categories: [{ id: 'common', name: '常用推荐' }],
  }, 0);
  assert.equal(changed.conflict, false);
  assert.equal(changed.changed, true);
  if (changed.conflict || !changed.changed) return;
  assert.equal(changed.data.version, 1);

  const conflict = await persistData(env, initial, 0);
  assert.equal(conflict.conflict, true);
  if (!conflict.conflict) return;
  assert.equal(conflict.current.version, 1);
});

test('writes only the fixed latest R2 object and skips the same hash', async () => {
  const kv = new MemoryKv();
  const r2 = new MemoryR2();
  const env = { NAVIX_KV: kv, NAVIX_BACKUPS: r2 };
  const data = normalizeData({ links: [], categories: [] });

  const first = await writeLatestBackup(env, data, 'same-hash');
  const second = await writeLatestBackup(env, data, 'same-hash');

  assert.equal(first.status, 'saved');
  assert.equal(second.status, 'skipped');
  assert.equal(r2.puts.length, 1);
  assert.equal(r2.puts[0].key, LATEST_BACKUP_KEY);
  assert.equal(r2.puts[0].metadata?.contentHash, 'same-hash');
});

test('does not let an older backup overwrite a newer stored version', async () => {
  const kv = new MemoryKv();
  const r2 = new MemoryR2();
  const env = { NAVIX_KV: kv, NAVIX_BACKUPS: r2 };
  await kv.put('app_data', JSON.stringify({ links: [], categories: [], version: 3 }));

  const result = await writeLatestBackup(env, normalizeData({ links: [], categories: [] }), 'old-hash');

  assert.equal(result.status, 'skipped');
  assert.equal(r2.puts.length, 0);
});

test('blocks private and loopback hosts while allowing public hosts', () => {
  const blocked = [
    'localhost', 'api.localhost', 'nas.local', 'metadata.internal',
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '2130706433',
    '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1',
  ];
  for (const host of blocked) {
    assert.equal(isBlockedHost(host), true, `${host} should be blocked`);
  }

  const allowed = ['api.openai.com', 'api.deepseek.com', '8.8.8.8', '1.1.1.1', 'example.com'];
  for (const host of allowed) {
    assert.equal(isBlockedHost(host), false, `${host} should be allowed`);
  }
});

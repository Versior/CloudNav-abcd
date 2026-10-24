import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost, onRequestPut } from '../functions/api/backup/r2.ts';
import { createSessionCookie } from '../functions/_shared/auth.ts';

const createKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) { return store.has(key) ? store.get(key) as string : null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace;
};

const createBucket = () => {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      if (!store.has(key)) return null;
      const value = store.get(key) as string;
      return { text: async () => value };
    },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as R2Bucket & { store: Map<string, string> };
};

const bundle = (hash = 'h1') => ({
  schemaVersion: 1,
  current: { hash, createdAt: 1, data: { links: [{ id: 'a' }], categories: [] } },
  rollback: null,
  updatedAt: 1,
  bundleHash: hash,
});

const envWith = async (overrides: Record<string, unknown> = {}) => {
  const kv = createKv();
  const env = { PASSWORD: 'pw', SESSION_SECRET: 'secret', CLOUDNAV_KV: kv, ...overrides };
  const cookie = (await createSessionCookie(env as never)).split(';')[0];
  return { env, cookie, kv };
};

const put = (cookie: string, body: unknown, env: object) => onRequestPut({
  request: new Request('https://example.com/api/backup/r2', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  }),
  env: env as never,
});

const get = (cookie: string, env: object) => onRequestGet({
  request: new Request('https://example.com/api/backup/r2', { headers: { Cookie: cookie } }),
  env: env as never,
});

const restore = (cookie: string, env: object) => onRequestPost({
  request: new Request('https://example.com/api/backup/r2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'restore' }),
  }),
  env: env as never,
});

test('R2 endpoints require authentication', async () => {
  const { env } = await envWith({ CLOUDNAV_BACKUPS: createBucket() });
  const anonymous = await onRequestGet({
    request: new Request('https://example.com/api/backup/r2'),
    env: env as never,
  });
  assert.equal(anonymous.status, 401);
});

test('a stored bundle can be read back as metadata', async () => {
  const bucket = createBucket();
  const { env, cookie } = await envWith({ CLOUDNAV_BACKUPS: bucket });

  const written = await put(cookie, bundle('h1'), env);
  assert.equal(written.status, 200);

  const meta = await (await get(cookie, env)).json();
  assert.equal(meta.bundleHash, 'h1');
  assert.equal(meta.hasCurrent, true);
  assert.equal(meta.hasRollback, false);
});

test('restore returns the stored bundle', async () => {
  const bucket = createBucket();
  const { env, cookie } = await envWith({ CLOUDNAV_BACKUPS: bucket });
  await put(cookie, bundle('h2'), env);

  const restored = await (await restore(cookie, env)).json();
  assert.equal(restored.current.hash, 'h2');
  assert.deepEqual(restored.current.data.links, [{ id: 'a' }]);
});

test('restore reports 404 when nothing was ever uploaded', async () => {
  const { env, cookie } = await envWith({ CLOUDNAV_BACKUPS: createBucket() });
  const response = await restore(cookie, env);
  assert.equal(response.status, 404);
});

test('a payload with neither generation is rejected', async () => {
  const bucket = createBucket();
  const { env, cookie } = await envWith({ CLOUDNAV_BACKUPS: bucket });
  const response = await put(cookie, { schemaVersion: 1, current: null, rollback: null }, env);
  assert.equal(response.status, 400);
  assert.equal(bucket.store.size, 0);
});

test('missing bucket binding degrades to 503 rather than crashing', async () => {
  const { env, cookie } = await envWith();
  const response = await get(cookie, env);
  assert.equal(response.status, 503);
});

test('an unknown action is rejected', async () => {
  const { env, cookie } = await envWith({ CLOUDNAV_BACKUPS: createBucket() });
  const response = await onRequestPost({
    request: new Request('https://example.com/api/backup/r2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ action: 'delete-everything' }),
    }),
    env: env as never,
  });
  assert.equal(response.status, 400);
});

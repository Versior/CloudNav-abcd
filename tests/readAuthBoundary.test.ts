import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as readStorage } from '../functions/api/storage.ts';
import { createSessionCookie } from '../functions/_shared/auth.ts';

const createKv = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key: string) { return store.has(key) ? store.get(key) as string : null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace & { store: Map<string, string> };
};

const baseEnv = { PASSWORD: 'pw', SESSION_SECRET: 'secret' };

const get = (path: string, env: Record<string, unknown>, headers: Record<string, string> = {}) => readStorage({
  request: new Request(`https://example.com${path}`, { headers }),
  env: env as never,
});

test('anonymous readers cannot see the full website config', async () => {
  const kv = createKv({ website_config: JSON.stringify({ title: 'T', passwordExpiryDays: 7 }) });
  const response = await get('/api/storage?getConfig=website', { ...baseEnv, CLOUDNAV_KV: kv });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.title, 'T', 'view fields stay public so the page can render');
  assert.equal(body.passwordExpiryDays, undefined, 'security settings must stay private');
});

test('anonymous readers cannot read search config at all', async () => {
  const kv = createKv({ search_config: JSON.stringify({ mode: 'internal', externalSources: [] }) });
  const response = await get('/api/storage?getConfig=search', { ...baseEnv, CLOUDNAV_KV: kv });

  assert.equal(response.status, 401);
});

test('authenticated readers still get the full website config', async () => {
  const kv = createKv({ website_config: JSON.stringify({ title: 'T', passwordExpiryDays: 7 }) });
  const env = { ...baseEnv, CLOUDNAV_KV: kv };
  const cookie = (await createSessionCookie(env)).split(';')[0];
  const response = await get('/api/storage?getConfig=website', env, { Cookie: cookie });

  const body = await response.json();
  assert.equal(body.passwordExpiryDays, 7);
});

test('authenticated readers still get search config', async () => {
  const kv = createKv({ search_config: JSON.stringify({ mode: 'internal' }) });
  const env = { ...baseEnv, CLOUDNAV_KV: kv };
  const cookie = (await createSessionCookie(env)).split(';')[0];
  const response = await get('/api/storage?getConfig=search', env, { Cookie: cookie });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, 'internal');
});

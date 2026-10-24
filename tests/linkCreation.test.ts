import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createLink } from '../functions/api/link.ts';
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

const authorizedEnv = async (kv: KVNamespace) => {
  const env = { PASSWORD: 'pw', SESSION_SECRET: 'secret', CLOUDNAV_KV: kv };
  const cookie = await createSessionCookie(env);
  return { env, cookie: cookie.split(';')[0] };
};

const postLink = (cookie: string, body: unknown, env: Record<string, unknown>) => createLink({
  request: new Request('https://example.com/api/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  }),
  env: env as never,
});

test('new links get unique ids even within the same millisecond', async () => {
  const kv = createKv({ app_data: JSON.stringify({ links: [], categories: [{ id: 'common', name: 'Common' }] }) });
  const { env, cookie } = await authorizedEnv(kv);

  const realNow = Date.now;
  Date.now = () => 1700000000123;
  try {
    for (const title of ['one', 'two', 'three']) {
      await postLink(cookie, { title, url: `https://${title}.example/`, categoryId: 'common' }, env);
    }
  } finally {
    Date.now = realNow;
  }

  const stored = JSON.parse(kv.store.get('app_data') as string);
  const ids = stored.links.map((link: { id: string }) => link.id);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3, `expected unique ids, got ${JSON.stringify(ids)}`);
});

test('concurrent link creation keeps every link', async () => {
  const kv = createKv({ app_data: JSON.stringify({ links: [], categories: [{ id: 'common', name: 'Common' }] }) });
  const { env, cookie } = await authorizedEnv(kv);

  await Promise.all(
    ['alpha', 'beta'].map(title => postLink(cookie, { title, url: `https://${title}.example/`, categoryId: 'common' }, env)),
  );

  const stored = JSON.parse(kv.store.get('app_data') as string);
  assert.equal(stored.links.length, 2, 'concurrent read-modify-write must not drop links');
});

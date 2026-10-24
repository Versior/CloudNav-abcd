import test from 'node:test';
import assert from 'node:assert/strict';
import { bumpTokenVersion, createExtensionToken, createSessionCookie, isAuthenticated, readTokenVersion } from '../functions/_shared/auth.ts';

const createKv = () => {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) { return store.has(key) ? store.get(key) as string : null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
  } as unknown as KVNamespace & { store: Map<string, string> };
};

const env = (kv?: KVNamespace) => ({ PASSWORD: 'pw', SESSION_SECRET: 'secret', CLOUDNAV_KV: kv });

test('a freshly issued session cookie authenticates', async () => {
  const kv = createKv();
  const cookie = await createSessionCookie(env(kv));
  const token = cookie.split(';')[0].split('=')[1];
  const request = new Request('https://example.com/', { headers: { Cookie: `cloudnav_session=${token}` } });
  assert.equal(await isAuthenticated(request, env(kv)), true);
});

test('logging out revokes previously issued extension tokens', async () => {
  const kv = createKv();
  const token = await createExtensionToken(env(kv));
  const withToken = () => new Request('https://example.com/', { headers: { Authorization: `Bearer ${token}` } });

  assert.equal(await isAuthenticated(withToken(), env(kv)), true);

  await bumpTokenVersion(env(kv));

  assert.equal(await isAuthenticated(withToken(), env(kv)), false);
});

test('logging out revokes previously issued session cookies', async () => {
  const kv = createKv();
  const cookie = await createSessionCookie(env(kv));
  const token = cookie.split(';')[0].split('=')[1];
  const withCookie = () => new Request('https://example.com/', { headers: { Cookie: `cloudnav_session=${token}` } });

  assert.equal(await isAuthenticated(withCookie(), env(kv)), true);
  await bumpTokenVersion(env(kv));
  assert.equal(await isAuthenticated(withCookie(), env(kv)), false);
});

test('a token issued after revocation works again', async () => {
  const kv = createKv();
  await bumpTokenVersion(env(kv));
  const token = await createExtensionToken(env(kv));
  const request = new Request('https://example.com/', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(await isAuthenticated(request, env(kv)), true);
});

test('tokens minted before revocation support still validate', async () => {
  // No KV configured means version 0 everywhere: legacy deployments keep working.
  const token = await createExtensionToken(env());
  const request = new Request('https://example.com/', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(await isAuthenticated(request, env()), true);
  assert.equal(await readTokenVersion(env()), 0);
});

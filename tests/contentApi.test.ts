import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/content.ts';

test('content API returns a clean readable document', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html><head><title>Reader</title></head><body><nav>Nav</nav><article><p>正文。</p></article></body></html>', { headers: { 'content-type': 'text/html' } });
  try {
    const response = await onRequestGet({ request: new Request('https://cloudnav.test/api/content?url=https%3A%2F%2Fexample.com%2Fstory') });
    const payload = await response.json() as { document?: { title?: string; content?: string } };
    assert.equal(response.status, 200);
    assert.equal(payload.document?.title, 'Reader');
    assert.equal(payload.document?.content, '正文。');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

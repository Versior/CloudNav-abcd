import test from 'node:test';
import assert from 'node:assert/strict';
import { extractReadableDocument } from '../services/contentParser.ts';

test('extracts title, metadata, and readable article text from HTML', () => {
  const result = extractReadableDocument(`
    <html><head><title>Fallback title</title>
      <meta property="og:title" content="CloudNav Reader">
      <meta name="description" content="A clean description">
      <meta name="author" content="Kai">
    </head><body><nav>Navigation</nav><article><h1>CloudNav Reader</h1><p>第一段正文。</p><p>第二段正文。</p><script>ignore()</script></article><footer>Footer</footer></body></html>
  `, 'https://example.com/story#comments');
  assert.equal(result.title, 'CloudNav Reader');
  assert.equal(result.url, 'https://example.com/story');
  assert.equal(result.author, 'Kai');
  assert.equal(result.summary, 'A clean description');
  assert.match(result.content || '', /第一段正文。/);
  assert.doesNotMatch(result.content || '', /ignore|Navigation|Footer/);
  assert.equal(result.type, 'article');
});

test('falls back to body text and limits dangerous or empty HTML', () => {
  const result = extractReadableDocument('<body><div>Body text</div><style>.x{}</style><img src="x"></body>', 'https://example.com');
  assert.equal(result.content, 'Body text');
  assert.equal(extractReadableDocument('<html><body></body></html>', 'https://example.com').content, undefined);
});

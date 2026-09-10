import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWebsiteSummarySource } from '../services/websiteSummaryService.ts';

test('website summary source prefers readable content and falls back to the saved description', () => {
  const source = buildWebsiteSummarySource({
    title: '示例站点',
    url: 'https://example.com',
    content: '  页面正文第一段  ',
    summary: '页面摘要',
  }, '保存的站点描述');

  assert.equal(source, '页面正文第一段');
});

test('website summary source rejects an empty page instead of sending a blank AI request', () => {
  assert.throws(
    () => buildWebsiteSummarySource({ title: '空页面', url: 'https://example.com' }, '   '),
    /没有可提取的正文内容/,
  );
});

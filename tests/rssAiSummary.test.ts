import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRssArticles } from '../services/rssService.ts';
import { parseRssSummaryResponse } from '../services/geminiService.ts';

test('RSS merge keeps generated AI summary metadata when a feed refreshes', () => {
  const existing = [{
    id: 'a', feedId: 'feed', title: '旧标题', url: 'https://example.test/a',
    aiSummary: '重点结论', aiBullets: ['一'], aiTags: ['AI'], aiUpdatedAt: 10,
  }];
  const merged = mergeRssArticles(existing, [{
    id: 'a', feedId: 'feed', title: '新标题', url: 'https://example.test/a', summary: '原始摘要',
  }], 'feed');
  assert.equal(merged[0].aiSummary, '重点结论');
  assert.deepEqual(merged[0].aiBullets, ['一']);
  assert.deepEqual(merged[0].aiTags, ['AI']);
});

test('AI RSS summary parser accepts fenced JSON and normalizes fields', () => {
  const parsed = parseRssSummaryResponse('```json\n{"summary":"一句话结论","bullets":["事实一","事实二"],"tags":["AI","开源"]}\n```');
  assert.deepEqual(parsed, { summary: '一句话结论', bullets: ['事实一', '事实二'], tags: ['AI', '开源'] });
});

test('AI RSS summary parser preserves facts, actions, and evidence separately', () => {
  const parsed = parseRssSummaryResponse('{"summary":"结论","facts":["事实"],"actions":["行动"],"evidence":["依据"],"tags":[]}');
  assert.deepEqual(parsed, {
    summary: '结论',
    bullets: ['事实'],
    facts: ['事实'],
    actions: ['行动'],
    evidence: ['依据'],
    tags: [],
  });
});

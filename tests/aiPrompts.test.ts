import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentSummaryPrompt } from '../services/aiPrompts.ts';

test('website summary prompt is source-grounded and asks for useful detail', () => {
  const prompt = buildContentSummaryPrompt('website', {
    title: '常用入口网站库',
    sourceTitle: 'CloudNav',
    summary: '标题：示例工具\n描述：用于整理资料',
  });

  assert.match(prompt.system, /只依据|不要臆测/);
  assert.match(prompt.user, /资料不足/);
  assert.match(prompt.user, /适合人群|主要用途/);
  assert.match(prompt.user, /bullets/);
  assert.match(prompt.user, /tags/);
});

test('RSS summary prompt separates facts from unsupported guesses', () => {
  const prompt = buildContentSummaryPrompt('rss', {
    title: '今日文章',
    sourceTitle: '中文资讯',
    summary: '文章摘要',
  });

  assert.match(prompt.system, /事实|臆测/);
  assert.match(prompt.user, /不要把推测写成事实/);
  assert.match(prompt.user, /关键事实/);
});

import { Category, AIConfig } from "../types";
import { normalizeOpenAIEndpoint } from './openaiEndpoint';

type AITask = 'description' | 'category' | 'test';

const isHtml = (text: string) => /<!doctype\s+html/i.test(text.trim()) || /<html[\s>]/i.test(text.trim());

const extractHtmlTitle = (text: string) => {
  const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
};

const parseJsonError = (rawText: string) => {
  try {
    const data = JSON.parse(rawText) as any;
    return typeof data.error === 'string' ? data.error : data.error?.message || data.message || rawText;
  } catch {
    return rawText;
  }
};

const parseJsonResponse = (rawText: string, provider: string, endpoint?: string) => {
  if (isHtml(rawText)) {
    const title = extractHtmlTitle(rawText);
    throw new Error(`${provider} 返回了 HTML 页面。最终请求地址：${endpoint || '未知'}${title ? `；网页标题：${title}` : ''}`);
  }
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`${provider} 返回的不是合法 JSON：${rawText.slice(0, 120)}`);
  }
};

const buildPrompts = (task: AITask, body: Record<string, unknown>) => {
  if (task === 'test') return { system: 'You are a connection tester. Reply with exactly OK.', user: 'Reply with exactly: OK' };
  if (task === 'description') {
    return {
      system: 'You are a helpful assistant that summarizes website bookmarks.',
      user: `Title: ${body.title}\nURL: ${body.url}\nPlease write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.`,
    };
  }
  const categories = (body.categories as Pick<Category, 'id' | 'name'>[] | undefined) || [];
  const catList = categories.map(c => `${c.id}: ${c.name}`).join('\n');
  return {
    system: 'You are an intelligent classification assistant. You only output the category ID.',
    user: `Website: "${body.title}" (${body.url})\n\nAvailable Categories:\n${catList}\n\nReturn ONLY the 'id' of the best matching category. If unsure, return 'common'.`,
  };
};

const sanitizeCategoryResponse = (text: string, categories: Pick<Category, 'id' | 'name'>[] = []) => {
  const cleaned = text.trim().replace(/```[\s\S]*?```/g, block => block.replace(/```\w*|```/g, '').trim()).replace(/^['"]|['"]$/g, '').trim();
  const ids = categories.map(c => c.id);
  if (ids.includes(cleaned)) return cleaned;
  return ids.find(id => new RegExp(`(^|[^a-zA-Z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9_-]|$)`).test(cleaned)) || null;
};

const callGeminiDirect = async (task: AITask, body: Record<string, unknown>, config: AIConfig) => {
  if (!config.apiKey) throw new Error('Gemini API key is not configured');
  const model = config.model || 'gemini-2.5-flash';
  const prompts = buildPrompts(task, body);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(`${endpoint}?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${prompts.system}\n${prompts.user}` }] }] }),
  });
  const rawText = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`Gemini 请求失败：HTTP ${response.status}，${parseJsonError(rawText).slice(0, 240)}`);
  const data = parseJsonResponse(rawText, 'Gemini', endpoint);
  return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '';
};

const callOpenAIDirect = async (task: AITask, body: Record<string, unknown>, config: AIConfig) => {
  if (!config.apiKey) throw new Error('OpenAI compatible API key is not configured');
  const endpoint = normalizeOpenAIEndpoint(config.baseUrl);
  const prompts = buildPrompts(task, body);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
      temperature: 0.2,
    }),
  });
  const rawText = await response.text().catch(() => '');
  if (!response.ok) throw new Error(`OpenAI Compatible 请求失败：HTTP ${response.status}，${parseJsonError(rawText).slice(0, 240)}`);
  const data = parseJsonResponse(rawText, 'OpenAI Compatible', endpoint);
  return data.choices?.[0]?.message?.content?.trim() || '';
};

const callDirectAI = async (task: AITask, body: Record<string, unknown>, config: AIConfig) => {
  const text = config.provider === 'openai'
    ? await callOpenAIDirect(task, body, config)
    : await callGeminiDirect(task, body, config);
  if (task === 'category') return sanitizeCategoryResponse(text, (body.categories as Pick<Category, 'id' | 'name'>[]) || []);
  return text;
};

const callAI = async (task: AITask, body: Record<string, unknown>, config: AIConfig): Promise<string | null> => {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, ...body, config })
    });

    const rawText = await response.text().catch(() => '');
    if (isHtml(rawText) && config.apiKey) return callDirectAI(task, body, config);
    let data: any = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch {
      throw new Error(`AI 代理返回的不是合法 JSON：${rawText.slice(0, 120)}`);
    }

    if (!response.ok) {
      if (isHtml(rawText) && config.apiKey) return callDirectAI(task, body, config);
      const detail = typeof data.error === 'string' && data.error.trim()
        ? data.error.trim()
        : isHtml(rawText)
          ? `AI 代理返回了 HTML 错误页（HTTP ${response.status}），请检查 Cloudflare Pages Functions 部署状态。`
          : rawText.trim() || `请求失败（HTTP ${response.status}）`;
      throw new Error(detail.slice(0, 300));
    }

    return typeof data.text === 'string' ? data.text.trim() : null;
  } catch (e) {
    if (e instanceof Error && /AI 代理返回了 HTML 错误页/.test(e.message) && config.apiKey) return callDirectAI(task, body, config);
    console.error("AI request failed", e);
    throw e;
  }
};

export const testAIConnection = async (config: AIConfig): Promise<string> => {
  const result = await callAI('test', { title: 'NaviX AI Test', url: 'https://example.com' }, config);
  return result || 'OK';
};

export const generateLinkDescription = async (title: string, url: string, config: AIConfig): Promise<string> => {
  const result = await callAI('description', { title, url }, config);
  if (!result) throw new Error('AI 未返回描述内容');
  return result;
};

export const suggestCategory = async (title: string, url: string, categories: Pick<Category, 'id' | 'name'>[], config: AIConfig): Promise<string | null> => {
  return callAI('category', { title, url, categories }, config);
};

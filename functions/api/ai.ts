import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import { normalizeOpenAIEndpoint } from '../../services/openaiEndpoint';

interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
  GEMINI_API_KEY?: string;
}

interface AIConfig {
  provider?: 'gemini' | 'openai';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

const readAiConfig = async (env: Env, requestConfig: AIConfig = {}) => {
  const value = await env.CLOUDNAV_KV.get('ai_config');
  const config = value ? JSON.parse(value) as AIConfig : {};
  return {
    provider: requestConfig.provider || config.provider || 'gemini',
    apiKey: requestConfig.apiKey || config.apiKey || env.GEMINI_API_KEY || '',
    baseUrl: requestConfig.baseUrl !== undefined ? requestConfig.baseUrl : config.baseUrl || '',
    model: requestConfig.model || config.model || 'gemini-2.5-flash',
  };
};

const isHtmlText = (text: string) => /^<!doctype\s+html/i.test(text.trim()) || /^<html[\s>]/i.test(text.trim());

const parseProviderErrorDetail = (raw: string) => {
  try {
    const data = JSON.parse(raw) as any;
    return data?.error?.message || data?.error || data?.message || raw;
  } catch {
    return raw;
  }
};

const parseProviderJson = (provider: string, raw: string) => {
  if (isHtmlText(raw)) {
    throw new Error(`${provider} 返回了 HTML 页面。API 地址大概率不是接口地址，或服务商网关返回了网页错误页。`);
  }
  try {
    return raw ? JSON.parse(raw) as any : {};
  } catch {
    throw new Error(`${provider} 返回的不是合法 JSON：${raw.slice(0, 120)}`);
  }
};

const validateAiConfig = (config: AIConfig) => {
  const provider = config.provider || 'gemini';
  const model = (config.model || '').trim();
  if (!model) throw new Error('模型名称不能为空');
  if (/^https?:\/\//i.test(model)) throw new Error('模型名称不能填写网址，请填写模型 ID');
  if (!config.apiKey) throw new Error('AI API key is not configured');
  if (provider === 'openai') normalizeOpenAIEndpoint(config.baseUrl);
};

const sanitizeCategoryResponse = (text: string, categories: Array<{ id: string; name: string }> = []) => {
  const cleaned = text.trim().replace(/```[\s\S]*?```/g, block => block.replace(/```\w*|```/g, '').trim()).replace(/^['"]|['"]$/g, '').trim();
  const ids = categories.map(c => c.id);
  if (ids.includes(cleaned)) return cleaned;
  const matched = ids.find(id => new RegExp(`(^|[^a-zA-Z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9_-]|$)`).test(cleaned));
  return matched || null;
};

const formatProviderError = (provider: string, response: Response, detail: string) => {
  const text = parseProviderErrorDetail(detail).toString().trim();
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || isHtmlText(text)) {
    return `${provider} 返回了 HTML 错误页（HTTP ${response.status}）。API 地址大概率填成了网页地址，请改成服务商的接口地址。`;
  }
  return `${provider} 请求失败：HTTP ${response.status}${text ? `，${text.slice(0, 300)}` : ''}`;
};

const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string) => {
  if (!config.apiKey || !config.baseUrl) throw new Error('OpenAI compatible API key or base URL is not configured');

  const baseUrl = normalizeOpenAIEndpoint(config.baseUrl);

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(formatProviderError('OpenAI Compatible', response, rawText));
  }
  const data = parseProviderJson('OpenAI Compatible', rawText);
  return data.choices?.[0]?.message?.content?.trim() || '';
};

const callGemini = async (config: AIConfig, prompt: string) => {
  if (!config.apiKey) throw new Error('Gemini API key is not configured');
  const model = config.model || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(formatProviderError('Gemini', response, rawText));
  }
  const data = parseProviderJson('Gemini', rawText);
  return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '';
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      task?: 'description' | 'category' | 'test';
      title?: string;
      url?: string;
      categories?: Array<{ id: string; name: string }>;
      config?: AIConfig;
    };

    if (!body.title || !body.url || !['description', 'category', 'test'].includes(body.task || '')) {
      return jsonResponse({ error: 'Invalid request' }, { status: 400 });
    }

    const config = await readAiConfig(env, body.config || {});
    validateAiConfig(config);

    if (body.task === 'test') {
      const text = config.provider === 'gemini'
        ? await callGemini(config, 'Reply with exactly: OK')
        : await callOpenAICompatible(config, 'You are a connection tester. Reply with exactly OK.', 'Reply with exactly: OK');
      return jsonResponse({ text: text || 'OK' });
    }

    if (body.task === 'description') {
      const prompt = `Title: ${body.title}\nURL: ${body.url}\nPlease write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.`;
      const text = config.provider === 'gemini'
        ? await callGemini(config, `I have a website bookmark. ${prompt}`)
        : await callOpenAICompatible(config, 'You are a helpful assistant that summarizes website bookmarks.', prompt);

      return jsonResponse({ text: text || '生成描述失败' });
    }

    const catList = (body.categories || []).map(c => `${c.id}: ${c.name}`).join('\n');
    const prompt = `Website: "${body.title}" (${body.url})\n\nAvailable Categories:\n${catList}\n\nReturn ONLY the 'id' of the best matching category. If unsure, return 'common'.`;
    const text = config.provider === 'gemini'
      ? await callGemini(config, `Task: Categorize this website.\n${prompt}`)
      : await callOpenAICompatible(config, 'You are an intelligent classification assistant. You only output the category ID.', prompt);

    const categoryId = sanitizeCategoryResponse(text || '', body.categories || []);
    return jsonResponse({ text: categoryId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return jsonResponse({ error: message }, { status: 502 });
  }
};

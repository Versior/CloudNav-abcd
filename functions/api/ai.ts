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

type AITask = 'description' | 'category' | 'test' | 'folder_rename' | 'folder_structure';

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

const extractHtmlTitle = (text: string) => {
  const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || '';
};

const parseProviderErrorDetail = (raw: string) => {
  try {
    const data = JSON.parse(raw) as any;
    return data?.error?.message || data?.error || data?.message || raw;
  } catch {
    return raw;
  }
};

const parseProviderJson = (provider: string, raw: string, endpoint?: string) => {
  if (isHtmlText(raw)) {
    const title = extractHtmlTitle(raw);
    throw new Error(`${provider} 返回了 HTML 页面。最终请求地址：${endpoint || '未知'}${title ? `；网页标题：${title}` : ''}`);
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

const cleanFolderName = (name: string) =>
  name
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^["'「『【\[]+|["'」』】\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

const formatProviderError = (provider: string, response: Response, detail: string) => {
  const text = parseProviderErrorDetail(detail).toString().trim();
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') || isHtmlText(text)) {
    return `${provider} 返回了 HTML 错误页（HTTP ${response.status}）。API 地址大概率填成了网页地址，请改成服务商的接口地址。`;
  }
  if (response.status === 429 || /rate limit|too many requests|quota/i.test(text)) {
    return `${provider} 请求失败：HTTP 429，限流中，请稍后重试。${text ? text.slice(0, 180) : ''}`;
  }
  return `${provider} 请求失败：HTTP ${response.status}${text ? `，${text.slice(0, 300)}` : ''}`;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const parseRetryAfterMs = (response: Response, rawText: string) => {
  const header = response.headers.get('retry-after');
  if (header) {
    const asNumber = Number(header);
    if (!Number.isNaN(asNumber) && asNumber >= 0) return Math.min(asNumber * 1000, 20000);
    const asDate = Date.parse(header);
    if (!Number.isNaN(asDate)) return Math.min(Math.max(asDate - Date.now(), 500), 20000);
  }
  try {
    const data = JSON.parse(rawText) as any;
    const retry = data?.error?.retry_after || data?.retry_after;
    if (typeof retry === 'number') return Math.min(Math.max(retry * 1000, 500), 20000);
  } catch {
    // ignore
  }
  return 0;
};

const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string, temperature = 0.7) => {
  if (!config.apiKey || !config.baseUrl) throw new Error('OpenAI compatible API key or base URL is not configured');

  const baseUrl = normalizeOpenAIEndpoint(config.baseUrl);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
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
        temperature,
      }),
    });

    const rawText = await response.text();
    if (response.ok) {
      const data = parseProviderJson('OpenAI Compatible', rawText, baseUrl);
      return data.choices?.[0]?.message?.content?.trim() || '';
    }

    lastError = new Error(formatProviderError('OpenAI Compatible', response, rawText));
    if (response.status !== 429 && response.status !== 503) throw lastError;
    if (attempt === 3) throw lastError;
    const wait = parseRetryAfterMs(response, rawText) || Math.min(800 * (2 ** (attempt - 1)), 6000);
    await sleep(wait);
  }

  throw lastError || new Error('OpenAI Compatible request failed');
};

const callGemini = async (config: AIConfig, prompt: string) => {
  if (!config.apiKey) throw new Error('Gemini API key is not configured');
  const model = config.model || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(config.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const rawText = await response.text();
    if (response.ok) {
      const data = parseProviderJson('Gemini', rawText, endpoint);
      return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '';
    }

    lastError = new Error(formatProviderError('Gemini', response, rawText));
    if (response.status !== 429 && response.status !== 503) throw lastError;
    if (attempt === 3) throw lastError;
    const wait = parseRetryAfterMs(response, rawText) || Math.min(800 * (2 ** (attempt - 1)), 6000);
    await sleep(wait);
  }

  throw lastError || new Error('Gemini request failed');
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      task?: AITask;
      title?: string;
      url?: string;
      categories?: Array<{ id: string; name: string }>;
      folderName?: string;
      samples?: string[];
      links?: Array<{ id: string; title: string; url: string; description?: string }>;
      existingNames?: string[];
      config?: AIConfig;
    };

    const task = body.task || '';
    const allowed: AITask[] = ['description', 'category', 'test', 'folder_rename', 'folder_structure'];
    if (!allowed.includes(task as AITask)) {
      return jsonResponse({ error: 'Invalid request' }, { status: 400 });
    }

    // legacy tasks still require title/url; folder tasks use synthetic placeholders from client
    if ((task === 'description' || task === 'category' || task === 'test') && (!body.title || !body.url)) {
      return jsonResponse({ error: 'Invalid request' }, { status: 400 });
    }
    if ((task === 'folder_rename' || task === 'folder_structure') && !body.folderName && !body.title) {
      return jsonResponse({ error: 'Invalid request' }, { status: 400 });
    }

    const config = await readAiConfig(env, body.config || {});
    validateAiConfig(config);

    if (task === 'test') {
      const text = config.provider === 'gemini'
        ? await callGemini(config, 'Reply with exactly: OK')
        : await callOpenAICompatible(config, 'You are a connection tester. Reply with exactly OK.', 'Reply with exactly: OK', 0.1);
      return jsonResponse({ text: text || 'OK' });
    }

    if (task === 'description') {
      const prompt = `Title: ${body.title}\nURL: ${body.url}\nPlease write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.`;
      const text = config.provider === 'gemini'
        ? await callGemini(config, `I have a website bookmark. ${prompt}`)
        : await callOpenAICompatible(config, 'You are a helpful assistant that summarizes website bookmarks.', prompt, 0.4);

      if (!text) throw new Error('AI 未返回描述内容');
      return jsonResponse({ text });
    }

    if (task === 'folder_rename') {
      const folderName = body.folderName || body.title || '';
      const samples = (body.samples || []).slice(0, 12);
      const userPrompt = `Current folder name: ${folderName}\nSample bookmarks:\n${samples.map((s, i) => `${i + 1}. ${s}`).join('\n') || '无'}\n\nSuggest a clearer Chinese folder name based on the bookmarks. Return ONLY the name.`;
      const text = config.provider === 'gemini'
        ? await callGemini(config, `You rename bookmark folders. Reply with ONLY a short Chinese folder name, max 12 characters. No quotes, no explanation.\n${userPrompt}`)
        : await callOpenAICompatible(config, 'You rename bookmark folders. Reply with ONLY a short Chinese folder name, max 12 characters. No quotes, no explanation.', userPrompt, 0.2);
      const cleaned = cleanFolderName(text || '');
      if (!cleaned) throw new Error('AI 未返回可用文件夹名称');
      return jsonResponse({ text: cleaned });
    }

    if (task === 'folder_structure') {
      const folderName = body.folderName || body.title || '';
      const links = (body.links || []).slice(0, 40);
      const existing = (body.existingNames || []).slice(0, 30);
      const userPrompt = `Parent folder: ${folderName}
Existing sibling/child folder names: ${existing.join('、') || '无'}
Bookmarks:
${links.map(l => `- id=${l.id} | ${l.title} | ${l.url}${l.description ? ` | ${l.description}` : ''}`).join('\n')}

Return JSON only with this shape:
{
  "rename": "optional better parent folder name in Chinese",
  "reason": "short reason",
  "folders": [
    { "name": "new child folder name", "linkIds": ["id1","id2"], "reason": "short reason" }
  ],
  "keepInParent": ["ids remaining in parent"]
}

Rules:
1. Names must be short Simplified Chinese, max 12 chars.
2. Prefer 2-6 child folders when bookmarks are mixed.
3. Every provided link id must appear exactly once in folders.linkIds or keepInParent.
4. Do not invent link ids.
5. Avoid duplicating existing folder names unless necessary.
6. If no structure change is needed, return empty folders and put all ids in keepInParent.`;
      const text = config.provider === 'gemini'
        ? await callGemini(config, `You reorganize bookmark folders. Return ONLY valid JSON, no markdown.\n${userPrompt}`)
        : await callOpenAICompatible(config, 'You reorganize bookmark folders. Return ONLY valid JSON, no markdown.', userPrompt, 0.3);
      if (!text) throw new Error('AI 未返回文件夹结构');
      return jsonResponse({ text });
    }

    const catList = (body.categories || []).map(c => `${c.id}: ${c.name}`).join('\n');
    const prompt = `Website: "${body.title}" (${body.url})\n\nAvailable Categories:\n${catList}\n\nReturn ONLY the 'id' of the best matching category. If unsure, return 'common'.`;
    const text = config.provider === 'gemini'
      ? await callGemini(config, `Task: Categorize this website.\n${prompt}`)
      : await callOpenAICompatible(config, 'You are an intelligent classification assistant. You only output the category ID.', prompt, 0.2);

    const categoryId = sanitizeCategoryResponse(text || '', body.categories || []);
    return jsonResponse({ text: categoryId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI request failed';
    return jsonResponse({ error: message }, { status: 502 });
  }
};

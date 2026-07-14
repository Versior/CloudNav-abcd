import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';

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

const readAiConfig = async (env: Env) => {
  const value = await env.CLOUDNAV_KV.get('ai_config');
  const config = value ? JSON.parse(value) as AIConfig : {};
  return {
    provider: config.provider || 'gemini',
    apiKey: config.apiKey || env.GEMINI_API_KEY || '',
    baseUrl: config.baseUrl || '',
    model: config.model || 'gemini-2.5-flash',
  };
};

const callOpenAICompatible = async (config: AIConfig, systemPrompt: string, userPrompt: string) => {
  if (!config.apiKey || !config.baseUrl) return '';

  let baseUrl = config.baseUrl.replace(/\/$/, '');
  if (!baseUrl.includes('/chat/completions')) {
    baseUrl += baseUrl.endsWith('/v1') ? '/chat/completions' : '/chat/completions';
  }

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

  if (!response.ok) return '';
  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content?.trim() || '';
};

const callGemini = async (config: AIConfig, prompt: string) => {
  if (!config.apiKey) return '';
  const model = config.model || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) return '';
  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '';
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as {
      task?: 'description' | 'category';
      title?: string;
      url?: string;
      categories?: Array<{ id: string; name: string }>;
    };

    if (!body.title || !body.url || (body.task !== 'description' && body.task !== 'category')) {
      return jsonResponse({ error: 'Invalid request' }, { status: 400 });
    }

    const config = await readAiConfig(env);
    if (!config.apiKey) {
      return jsonResponse({ error: 'AI API key is not configured' }, { status: 400 });
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

    return jsonResponse({ text: text || null });
  } catch {
    return jsonResponse({ error: 'AI request failed' }, { status: 500 });
  }
};

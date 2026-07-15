import { Category, AIConfig, LinkItem } from "../types";
import { normalizeOpenAIEndpoint } from './openaiEndpoint';

type AITask = 'description' | 'category' | 'test' | 'folder_rename' | 'folder_structure';

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

const stripCodeFence = (text: string) =>
  text.trim().replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

const cleanFolderName = (name: string) =>
  name
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/^["'「『【\[]+|["'」』】\]]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

export interface FolderRenameSuggestion {
  name: string;
  reason?: string;
}

export interface FolderStructureSuggestion {
  rename?: string;
  reason?: string;
  folders: Array<{
    name: string;
    linkIds: string[];
    reason?: string;
  }>;
  keepInParent: string[];
}

const buildPrompts = (task: AITask, body: Record<string, unknown>) => {
  if (task === 'test') return { system: 'You are a connection tester. Reply with exactly OK.', user: 'Reply with exactly: OK' };
  if (task === 'description') {
    return {
      system: 'You are a helpful assistant that summarizes website bookmarks.',
      user: `Title: ${body.title}\nURL: ${body.url}\nPlease write a very short description (max 15 words) in Chinese (Simplified) that explains what this website is for. Return ONLY the description text. No quotes.`,
    };
  }
  if (task === 'folder_rename') {
    const samples = (body.samples as string[] | undefined) || [];
    return {
      system: 'You rename bookmark folders. Reply with ONLY a short Chinese folder name, max 12 characters. No quotes, no explanation.',
      user: `Current folder name: ${body.folderName}\nSample bookmarks:\n${samples.map((s, i) => `${i + 1}. ${s}`).join('\n') || '无'}\n\nSuggest a clearer Chinese folder name based on the bookmarks. Return ONLY the name.`,
    };
  }
  if (task === 'folder_structure') {
    const links = (body.links as Array<{ id: string; title: string; url: string; description?: string }> | undefined) || [];
    const existing = (body.existingNames as string[] | undefined) || [];
    return {
      system: 'You reorganize bookmark folders. Return ONLY valid JSON, no markdown.',
      user: `Parent folder: ${body.folderName}
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
6. If no structure change is needed, return empty folders and put all ids in keepInParent.`,
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

const parseFolderRename = (text: string, fallbackName: string): FolderRenameSuggestion => {
  const cleaned = cleanFolderName(stripCodeFence(text));
  if (!cleaned) throw new Error('AI 未返回可用文件夹名称');
  if (cleaned === cleanFolderName(fallbackName)) {
    return { name: cleaned, reason: '保持原名' };
  }
  return { name: cleaned };
};

const parseFolderStructure = (
  text: string,
  links: Array<{ id: string; title: string; url: string; description?: string }>
): FolderStructureSuggestion => {
  const raw = stripCodeFence(text);
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 未返回合法的文件夹结构 JSON');
    data = JSON.parse(match[0]);
  }

  const validIds = new Set(links.map(l => l.id));
  const used = new Set<string>();
  const folders: FolderStructureSuggestion['folders'] = [];

  for (const folder of Array.isArray(data.folders) ? data.folders : []) {
    const name = cleanFolderName(String(folder?.name || ''));
    if (!name) continue;
    const linkIds = Array.isArray(folder?.linkIds)
      ? folder.linkIds.map((id: unknown) => String(id)).filter((id: string) => validIds.has(id) && !used.has(id))
      : [];
    linkIds.forEach((id: string) => used.add(id));
    if (linkIds.length === 0) continue;
    folders.push({
      name,
      linkIds,
      reason: typeof folder?.reason === 'string' ? folder.reason.slice(0, 80) : undefined,
    });
  }

  const keepFromAi = Array.isArray(data.keepInParent)
    ? data.keepInParent.map((id: unknown) => String(id)).filter((id: string) => validIds.has(id) && !used.has(id))
    : [];
  keepFromAi.forEach((id: string) => used.add(id));

  const missing = links.map(l => l.id).filter(id => !used.has(id));
  const keepInParent = [...keepFromAi, ...missing];
  const rename = data.rename ? cleanFolderName(String(data.rename)) : undefined;

  return {
    rename: rename || undefined,
    reason: typeof data.reason === 'string' ? data.reason.slice(0, 120) : undefined,
    folders,
    keepInParent,
  };
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
      temperature: task === 'folder_structure' ? 0.3 : 0.2,
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

export const suggestFolderRename = async (
  folderName: string,
  samples: string[],
  config: AIConfig
): Promise<FolderRenameSuggestion> => {
  const result = await callAI('folder_rename', {
    title: folderName,
    url: 'https://folder.local/rename',
    folderName,
    samples: samples.slice(0, 12),
  }, config);
  if (!result) throw new Error('AI 未返回文件夹名称');
  return parseFolderRename(result, folderName);
};

export const suggestFolderStructure = async (
  folderName: string,
  links: Array<Pick<LinkItem, 'id' | 'title' | 'url' | 'description'>>,
  existingNames: string[],
  config: AIConfig
): Promise<FolderStructureSuggestion> => {
  const compactLinks = links.slice(0, 40).map(l => ({
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description,
  }));
  const result = await callAI('folder_structure', {
    title: folderName,
    url: 'https://folder.local/structure',
    folderName,
    links: compactLinks,
    existingNames: existingNames.slice(0, 30),
  }, config);
  if (!result) throw new Error('AI 未返回文件夹结构');
  return parseFolderStructure(result, compactLinks);
};

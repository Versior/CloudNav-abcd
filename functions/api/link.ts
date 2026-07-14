import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';

interface Env {
  CLOUDNAV_KV: KVNamespace;
  PASSWORD: string;
  SESSION_SECRET?: string;
}

interface LinkData {
  title?: string;
  url?: string;
  description?: string;
  categoryId?: string;
}

const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.includes(':')) return true;
  const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};

const handleCheckHealth = async (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return jsonResponse({ status: 'invalid', error: 'URL must use http or https' }, { status: 400 });
    }
    if (isPrivateHostname(parsed.hostname)) {
      return jsonResponse({ status: 'invalid', error: 'Private/internal URLs are not allowed' }, { status: 400 });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
    clearTimeout(timeout);
    const status = response.status >= 200 && response.status < 400 ? 'ok' : response.status >= 400 ? 'broken' : 'unknown';
    return jsonResponse({ status, statusCode: response.status, finalUrl: response.headers.get('Location') || url, checkedAt: Date.now() });
  } catch {
    return jsonResponse({ status: 'broken', statusCode: 0, error: 'Request failed', checkedAt: Date.now() });
  }
};

export const onRequestOptions = async () => optionsResponse();

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as LinkData & { action?: string };

    if (body.action === 'checkHealth') {
      return await handleCheckHealth(body.url || '');
    }

    if (!body.title || !body.url) {
      return jsonResponse({ error: 'Missing title or url' }, { status: 400 });
    }

    const currentDataStr = await env.CLOUDNAV_KV.get('app_data');
    const currentData = currentDataStr ? JSON.parse(currentDataStr) : { links: [], categories: [] };

    let targetCatId = '';
    let targetCatName = '';

    if (body.categoryId) {
      const explicitCat = currentData.categories.find((c: any) => c.id === body.categoryId);
      if (explicitCat) {
        targetCatId = explicitCat.id;
        targetCatName = explicitCat.name;
      }
    }

    if (!targetCatId) {
      if (currentData.categories && currentData.categories.length > 0) {
        const keywords = ['收集', '未分类', 'inbox', 'temp', 'later'];
        const match = currentData.categories.find((c: any) =>
          keywords.some(k => c.name.toLowerCase().includes(k))
        );

        if (match) {
          targetCatId = match.id;
          targetCatName = match.name;
        } else {
          const common = currentData.categories.find((c: any) => c.id === 'common');
          if (common) {
            targetCatId = 'common';
            targetCatName = common.name;
          } else {
            targetCatId = currentData.categories[0].id;
            targetCatName = currentData.categories[0].name;
          }
        }
      } else {
        targetCatId = 'common';
        targetCatName = '默认';
      }
    }

    const newLink = {
      id: Date.now().toString(),
      title: body.title,
      url: body.url,
      description: body.description || '',
      categoryId: targetCatId,
      createdAt: Date.now(),
      pinned: false,
      icon: undefined,
    };

    currentData.links = [newLink, ...(currentData.links || [])];
    await env.CLOUDNAV_KV.put('app_data', JSON.stringify(currentData));

    return jsonResponse({
      success: true,
      link: newLink,
      categoryName: targetCatName,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, { status: 500 });
  }
};

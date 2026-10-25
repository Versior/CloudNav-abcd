import { jsonResponse, optionsResponse, requireAuth } from '../_shared/auth';
import { LATEST_BACKUP_KEY, persistData, readStoredData, StorageEnv, writeLatestBackup } from '../_shared/dataStore';

interface Env extends StorageEnv {
  PASSWORD: string;
  SESSION_SECRET?: string;
}

interface LinkData {
  title?: string;
  url?: string;
  description?: string;
  categoryId?: string;
  icon?: string;
}

export const onRequestOptions = async (context: { request: Request }) => optionsResponse(context.request);

export const onRequestPost = async (context: { request: Request; env: Env; waitUntil?: (promise: Promise<unknown>) => void }) => {
  const { request, env, waitUntil } = context;
  const authError = await requireAuth(request, env);
  if (authError) return authError;

  try {
    const body = await request.json() as LinkData;
    if (!body.title?.trim() || !body.url?.trim()) {
      return jsonResponse({ error: 'Missing title or url' }, { status: 400 }, request);
    }

    const currentData = await readStoredData(env);
    const targetCategory = body.categoryId && currentData.categories.find(category => category.id === body.categoryId)
      || currentData.categories.find(category => category.id === 'common');
    const targetCatId = String(targetCategory?.id || 'common');
    const targetCatName = String(targetCategory?.name || '常用推荐');
    const now = Date.now();
    const newLink = {
      id: `${now}-${Math.random().toString(16).slice(2)}`,
      title: body.title.trim(),
      url: body.url.trim(),
      description: body.description?.trim() || '',
      categoryId: targetCatId,
      createdAt: now,
      pinned: false,
      ...(body.icon ? { icon: body.icon } : {}),
    };

    const result = await persistData(env, {
      links: [newLink, ...currentData.links],
      categories: currentData.categories,
    }, currentData.version);

    if (result.conflict === true) {
      return jsonResponse({ error: 'Data conflict', data: result.current }, { status: 409 }, request);
    }
    if (result.changed === false) {
      return jsonResponse({ error: 'Link was not saved' }, { status: 409 }, request);
    }

    const backupPromise = writeLatestBackup(env, result.data, result.hash);
    if (waitUntil) waitUntil(backupPromise.catch(() => undefined));
    const backup = waitUntil
      ? { status: 'scheduled' as const, key: LATEST_BACKUP_KEY }
      : await backupPromise.catch(() => ({ status: 'failed' as const }));

    return jsonResponse({
      success: true,
      link: newLink,
      category: { id: targetCatId, name: targetCatName },
      version: result.data.version,
      backup,
    }, {}, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return jsonResponse({ error: message }, { status: 500 }, request);
  }
};

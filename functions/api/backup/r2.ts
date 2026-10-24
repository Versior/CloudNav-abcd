import { jsonResponse, optionsResponse, requireAuth } from '../../_shared/auth.ts';

interface Env {
  CLOUDNAV_KV?: KVNamespace;
  CLOUDNAV_BACKUPS?: R2Bucket;
  PASSWORD: string;
  SESSION_SECRET?: string;
}

/**
 * R2 云备份。
 *
 *   GET  /api/backup/r2                        读取远端备份元信息
 *   PUT  /api/backup/r2   <bundle>             写入整份备份
 *   POST /api/backup/r2   { action: 'restore' } 取回最新可用备份
 *
 * 备份是整份 JSON 快照，包含 current/rollback 两代，写入时整体替换，
 * 不做字段级合并：备份的价值在于“那一刻的完整状态”。
 */

const BACKUP_OBJECT_KEY = 'cloudnav-backup.json';
const MAX_BUNDLE_BYTES = 4 * 1024 * 1024;

interface BackupGeneration {
  hash: string;
  createdAt: number;
  data: unknown;
}

interface BackupBundle {
  schemaVersion?: number;
  current?: BackupGeneration | null;
  rollback?: BackupGeneration | null;
  updatedAt?: number;
  bundleHash?: string;
}

const isGeneration = (value: unknown): value is BackupGeneration => {
  if (!value || typeof value !== 'object') return false;
  const record = value as BackupGeneration;
  return typeof record.hash === 'string' && typeof record.createdAt === 'number' && !!record.data && typeof record.data === 'object';
};

const normalizeBundle = (value: unknown): BackupBundle | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as BackupBundle;
  const current = isGeneration(record.current) ? record.current : null;
  const rollback = isGeneration(record.rollback) ? record.rollback : null;
  if (!current && !rollback) return null;
  return {
    schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : 1,
    current,
    rollback,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now(),
    bundleHash: typeof record.bundleHash === 'string' && record.bundleHash
      ? record.bundleHash
      : current?.hash || rollback?.hash || 'empty',
  };
};

const readStored = async (env: Env): Promise<BackupBundle | null> => {
  if (!env.CLOUDNAV_BACKUPS) return null;
  const object = await env.CLOUDNAV_BACKUPS.get(BACKUP_OBJECT_KEY);
  if (!object) return null;
  try {
    return normalizeBundle(JSON.parse(await object.text()));
  } catch {
    return null;
  }
};

const metaOf = (bundle: BackupBundle | null) => ({
  bundleHash: bundle?.bundleHash ?? '',
  updatedAt: bundle?.updatedAt ?? 0,
  hasCurrent: !!bundle?.current,
  hasRollback: !!bundle?.rollback,
  schemaVersion: bundle?.schemaVersion ?? 1,
});

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const authError = await requireAuth(context.request, context.env);
  if (authError) return authError;

  if (!context.env.CLOUDNAV_BACKUPS) {
    return jsonResponse({ error: 'R2 bucket is not configured' }, { status: 503 });
  }

  try {
    return jsonResponse(metaOf(await readStored(context.env)));
  } catch {
    return jsonResponse({ error: 'Failed to read R2 backup' }, { status: 500 });
  }
};

export const onRequestPut = async (context: { request: Request; env: Env }) => {
  const authError = await requireAuth(context.request, context.env);
  if (authError) return authError;

  if (!context.env.CLOUDNAV_BACKUPS) {
    return jsonResponse({ error: 'R2 bucket is not configured' }, { status: 503 });
  }

  try {
    const contentLength = Number(context.request.headers.get('content-length') || 0);
    if (contentLength > MAX_BUNDLE_BYTES) {
      return jsonResponse({ error: 'Backup payload is too large' }, { status: 413 });
    }

    const rawBody = await context.request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BUNDLE_BYTES) {
      return jsonResponse({ error: 'Backup payload is too large' }, { status: 413 });
    }

    const bundle = normalizeBundle(JSON.parse(rawBody));
    if (!bundle) {
      return jsonResponse({ error: 'Invalid backup payload' }, { status: 400 });
    }

    await context.env.CLOUDNAV_BACKUPS.put(BACKUP_OBJECT_KEY, JSON.stringify(bundle), {
      httpMetadata: { contentType: 'application/json' },
    });

    return jsonResponse({ success: true, ...metaOf(bundle) });
  } catch {
    return jsonResponse({ error: 'Failed to write R2 backup' }, { status: 500 });
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const authError = await requireAuth(context.request, context.env);
  if (authError) return authError;

  let action = '';
  try {
    const body = await context.request.json() as { action?: string };
    action = typeof body.action === 'string' ? body.action : '';
  } catch {
    return jsonResponse({ error: 'Invalid request' }, { status: 400 });
  }

  if (action !== 'restore') {
    return jsonResponse({ error: 'Invalid action' }, { status: 400 });
  }

  if (!context.env.CLOUDNAV_BACKUPS) {
    return jsonResponse({ error: 'R2 bucket is not configured' }, { status: 503 });
  }

  try {
    const bundle = await readStored(context.env);
    if (!bundle) {
      return jsonResponse({ error: 'No backup available' }, { status: 404 });
    }
    return jsonResponse(bundle);
  } catch {
    return jsonResponse({ error: 'Failed to read R2 backup' }, { status: 500 });
  }
};

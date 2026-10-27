export const APP_DATA_KEY = 'app_data';
/**
 * R2 固定备份对象键。
 *
 * 保持 `cloudnav/` 前缀不变：这是已部署实例里真实存在的对象，
 * 改名会影响线上备份的读写位置，属于数据迁移，不做。
 */
export const LATEST_BACKUP_KEY = 'cloudnav/latest.json';

export interface StorageEnv {
  COVE_KV?: KVNamespace;
  COVE_BACKUPS?: R2Bucket;
  NAVIX_KV?: KVNamespace;
  CLOUDNAV_KV?: KVNamespace;
  NAVIX_BACKUPS?: R2Bucket;
  CLOUDNAV_BACKUPS?: R2Bucket;
}

/**
 * R2 绑定：按 新名 → 旧名 的顺序探测。
 * 换名后若忘记改绑定，备份会静默失效，所以这里必须同时兼容三代命名。
 */
export const getBackupBucket = (env: StorageEnv): R2Bucket | undefined =>
  env.COVE_BACKUPS || env.NAVIX_BACKUPS || env.CLOUDNAV_BACKUPS;

export interface StoredData {
  links: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  version: number;
  updatedAt?: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? value as Record<string, unknown> : {};

const cleanCategories = (value: unknown): Record<string, unknown>[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const categories = source
    .map(asRecord)
    .filter(category => typeof category.id === 'string' && typeof category.name === 'string')
    .filter(category => {
      const id = String(category.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  if (!seen.has('common')) categories.unshift({ id: 'common', name: '常用推荐', icon: 'Star' });
  return categories;
};

const cleanLinks = (value: unknown, categoryIds: Set<string>): Record<string, unknown>[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return source
    .map(asRecord)
    .filter(link => typeof link.id === 'string' && typeof link.title === 'string' && typeof link.url === 'string')
    .filter(link => {
      const id = String(link.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(link => {
      const { credentials: _credentials, health: _health, ...rest } = link;
      const rawCategoryId = String(rest.categoryId || 'common');
      const categoryId = rawCategoryId === '__inbox__' || !categoryIds.has(rawCategoryId)
        ? 'common'
        : rawCategoryId;
      return { ...rest, categoryId };
    });
};

export const normalizeData = (value: unknown): StoredData => {
  const record = asRecord(value);
  const categories = cleanCategories(record.categories);
  const categoryIds = new Set(categories.map(category => String(category.id)));
  const links = cleanLinks(record.links, categoryIds);
  const version = typeof record.version === 'number' && Number.isFinite(record.version) && record.version >= 0
    ? Math.floor(record.version)
    : 0;
  const updatedAt = typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
    ? record.updatedAt
    : undefined;
  return { links, categories, version, updatedAt };
};

export const getStorageKv = (env: StorageEnv): KVNamespace => {
  const kv = env.COVE_KV || env.NAVIX_KV || env.CLOUDNAV_KV;
  if (!kv) throw new Error('KV 绑定未配置：请绑定 COVE_KV（兼容旧名 NAVIX_KV / CLOUDNAV_KV）');
  return kv;
};

const contentOf = (data: StoredData) => ({ links: data.links, categories: data.categories });

export const hashData = async (data: StoredData): Promise<string> => {
  const encoded = new TextEncoder().encode(JSON.stringify(contentOf(data)));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
};

export const readStoredDataWithPresence = async (env: StorageEnv) => {
  const raw = await getStorageKv(env).get(APP_DATA_KEY);
  if (!raw) return { data: normalizeData({}), exists: false };
  try {
    return { data: normalizeData(JSON.parse(raw)), exists: true };
  } catch {
    return { data: normalizeData({}), exists: true };
  }
};

export const readStoredData = async (env: StorageEnv): Promise<StoredData> =>
  (await readStoredDataWithPresence(env)).data;

let latestBackupQueue: Promise<void> = Promise.resolve();

export const writeLatestBackup = async (env: StorageEnv, data: StoredData, hash: string) => {
  const bucket = getBackupBucket(env);
  if (!bucket) return { status: 'missing-binding' as const };
  const operation = latestBackupQueue.then(async () => {
    // Do not let an older request overwrite a newer KV version after a race.
    const current = await readStoredData(env);
    if (current.version > data.version) {
      return { status: 'skipped' as const, key: LATEST_BACKUP_KEY };
    }

    const existing = await bucket.head(LATEST_BACKUP_KEY);
    const existingHash = existing?.customMetadata?.contentHash;
    const existingVersion = Number(existing?.customMetadata?.version || NaN);
    if (existingHash === hash || (Number.isFinite(existingVersion) && existingVersion > data.version)) {
      return { status: 'skipped' as const, key: LATEST_BACKUP_KEY };
    }

    await bucket.put(LATEST_BACKUP_KEY, JSON.stringify(data), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
      customMetadata: { contentHash: hash, version: String(data.version) },
    });
    return { status: 'saved' as const, key: LATEST_BACKUP_KEY };
  });

  // A failed backup must not poison later writes in the same Pages isolate.
  latestBackupQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

export const pruneLatestBackups = async (env: StorageEnv) => {
  const bucket = getBackupBucket(env);
  if (!bucket) return { status: 'missing-binding' as const, deleted: [] as string[] };

  const deleted: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({
      prefix: 'cloudnav/',
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const object of page.objects || []) {
      if (object.key === LATEST_BACKUP_KEY) continue;
      await bucket.delete(object.key);
      deleted.push(object.key);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return { status: 'cleaned' as const, deleted };
};

let persistQueue: Promise<void> = Promise.resolve();

type PersistResult =
  | { conflict: true; current: StoredData }
  | { conflict: false; changed: false; data: StoredData; backup: { status: 'skipped' } }
  | { conflict: false; changed: true; data: StoredData; hash: string };

export const persistData = (
  env: StorageEnv,
  input: { links: unknown; categories: unknown },
  baseVersion?: number
): Promise<PersistResult> => {
  const operation = persistQueue.then(async () => {
    const current = await readStoredData(env);
    if (typeof baseVersion === 'number' && baseVersion !== current.version) {
      return { conflict: true as const, current };
    }

    const nextContent = normalizeData({ links: input.links, categories: input.categories });
    const currentHash = await hashData(current);
    const nextHash = await hashData(nextContent);
    if (currentHash === nextHash) {
      return { conflict: false as const, changed: false as const, data: current, backup: { status: 'skipped' as const } };
    }

    const data: StoredData = {
      ...nextContent,
      version: current.version + 1,
      updatedAt: Date.now(),
    };
    await getStorageKv(env).put(APP_DATA_KEY, JSON.stringify(data));
    return { conflict: false as const, changed: true as const, data, hash: nextHash };
  });

  // A rejected operation must not block the next request handled by this isolate.
  persistQueue = operation.then(() => undefined, () => undefined);
  return operation;
};

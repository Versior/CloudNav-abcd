/**
 * R2 云备份。
 *
 * 协议（与线上 2026-09-21 版本一致）：
 *   GET  /api/backup/r2                     读取远端备份元信息
 *   PUT  /api/backup/r2  <bundle>           上传整份备份
 *   POST /api/backup/r2  {action:'restore'} 取回最新可用备份
 *
 * 冷却与去重规则由前端决定：每日模式 24 小时内不重复上传，
 * 内容 hash 未变化时也不上传。
 */

export type R2BackupMode = 'manual' | 'daily';

export interface R2BackupPolicy {
  mode: R2BackupMode;
  lastUploadedAt: number;
  lastUploadedHash: string;
}

export interface R2BackupMeta {
  bundleHash?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export interface R2BackupBundle<T = unknown> {
  schemaVersion: number;
  current: { hash: string; createdAt: number; data: T } | null;
  rollback: { hash: string; createdAt: number; data: T } | null;
  updatedAt: number;
  bundleHash: string;
}

export interface R2UploadDecision {
  allowed: boolean;
  reason: 'unchanged' | 'cooldown' | 'manual';
}

export interface R2UploadResult extends R2UploadDecision {
  uploaded: boolean;
  bundleHash: string;
}

export const R2_DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const R2_POLICY_KEY = 'cloudnav_r2_backup_policy_v1';
export const R2_META_KEY = 'cloudnav_r2_backup_meta_v1';

export const defaultPolicy = (): R2BackupPolicy => ({
  mode: 'manual',
  lastUploadedAt: 0,
  lastUploadedHash: '',
});

export const readPolicy = (): R2BackupPolicy => {
  if (typeof localStorage === 'undefined') return defaultPolicy();
  try {
    const raw = JSON.parse(localStorage.getItem(R2_POLICY_KEY) || 'null');
    return {
      mode: raw?.mode === 'daily' ? 'daily' : 'manual',
      lastUploadedAt: Number(raw?.lastUploadedAt || 0),
      lastUploadedHash: typeof raw?.lastUploadedHash === 'string' ? raw.lastUploadedHash : '',
    };
  } catch {
    return defaultPolicy();
  }
};

export const writePolicy = (policy: R2BackupPolicy) => {
  try {
    localStorage.setItem(R2_POLICY_KEY, JSON.stringify(policy));
  } catch {
    // 存储不可用时保持静默，避免打断备份流程
  }
};

export const writeMeta = (meta: R2BackupMeta) => {
  try {
    localStorage.setItem(R2_META_KEY, JSON.stringify(meta));
  } catch {
    // 同上
  }
};

export const readMeta = (): R2BackupMeta | null => {
  try {
    const raw = localStorage.getItem(R2_META_KEY);
    return raw ? JSON.parse(raw) as R2BackupMeta : null;
  } catch {
    return null;
  }
};

/** 是否应该跳过这次上传。 */
export const decideUpload = (params: {
  mode: R2BackupMode;
  lastUploadedAt: number;
  localHash: string;
  remoteHash?: string;
  now?: number;
}): R2UploadDecision => {
  if (params.localHash && params.localHash === params.remoteHash) {
    return { allowed: false, reason: 'unchanged' };
  }
  if (params.mode === 'daily' && (params.now ?? Date.now()) - params.lastUploadedAt < R2_DAILY_COOLDOWN_MS) {
    return { allowed: false, reason: 'cooldown' };
  }
  return { allowed: true, reason: 'manual' };
};

/** 用本地轮换快照组装 R2 备份载荷。 */
export const buildBundle = <T,>(
  snapshot: { current?: { hash: string; createdAt: number; data: T } | null; rollback?: { hash: string; createdAt: number; data: T } | null },
  now = Date.now(),
): R2BackupBundle<T> => ({
  schemaVersion: 1,
  current: snapshot.current ?? null,
  rollback: snapshot.rollback ?? null,
  updatedAt: now,
  bundleHash: snapshot.current?.hash || snapshot.rollback?.hash || 'empty',
});

const parse = async (response: Response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body.error === 'string' ? body.error : `R2 request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
};

const authHeaders = { 'Content-Type': 'application/json' } as const;

export const fetchRemoteMeta = async (): Promise<R2BackupMeta> =>
  parse(await fetch('/api/backup/r2', { credentials: 'same-origin' })) ?? {};

export const uploadBundle = async <T,>(bundle: R2BackupBundle<T>): Promise<R2BackupMeta> =>
  parse(await fetch('/api/backup/r2', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: authHeaders,
    body: JSON.stringify(bundle),
  })) ?? {};

export const restoreBundle = async <T,>(): Promise<R2BackupBundle<T>> =>
  (await parse(await fetch('/api/backup/r2', {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders,
    body: JSON.stringify({ action: 'restore' }),
  }))) as R2BackupBundle<T>;

/**
 * 完整同步流程：必要时上传，成功后写回策略与元信息。
 */
export const syncBackup = async <T,>(
  bundle: R2BackupBundle<T>,
  policy: R2BackupPolicy = readPolicy(),
  remoteHash?: string,
): Promise<R2UploadResult> => {
  const decision = decideUpload({
    mode: policy.mode,
    lastUploadedAt: policy.lastUploadedAt,
    localHash: bundle.bundleHash,
    remoteHash,
  });

  if (!decision.allowed) {
    return { ...decision, uploaded: false, bundleHash: bundle.bundleHash };
  }

  await uploadBundle(bundle);

  const next: R2BackupPolicy = {
    ...policy,
    lastUploadedAt: Date.now(),
    lastUploadedHash: bundle.bundleHash,
  };
  writePolicy(next);
  writeMeta({ updatedAt: next.lastUploadedAt, bundleHash: bundle.bundleHash });

  return { ...decision, uploaded: true, bundleHash: bundle.bundleHash };
};

export const describeResult = (result: R2UploadResult, mode: R2BackupMode): string => {
  if (result.uploaded) return mode === 'daily' ? 'R2 每日备份已更新' : 'R2 备份已更新';
  if (result.reason === 'cooldown') return 'R2 仍在冷却期，本次未上传';
  return 'R2 内容未变化，无需上传';
};

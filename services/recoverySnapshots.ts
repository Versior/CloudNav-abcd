export interface RecoverySnapshot {
  id: string;
  createdAt: number;
  links: unknown[];
  categories: unknown[];
  linkCount: number;
  categoryCount: number;
}

export const createRecoverySnapshot = (value: { links: unknown[]; categories: unknown[] }, createdAt = Date.now()): RecoverySnapshot => ({
  id: `local-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt,
  links: value.links,
  categories: value.categories,
  linkCount: value.links.length,
  categoryCount: value.categories.length,
});

export const normalizeRecoverySnapshots = (value: unknown): RecoverySnapshot[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is RecoverySnapshot => !!item && typeof item === 'object' && typeof (item as RecoverySnapshot).id === 'string' && typeof (item as RecoverySnapshot).createdAt === 'number' && Array.isArray((item as RecoverySnapshot).links) && Array.isArray((item as RecoverySnapshot).categories)).map(item => ({
    id: item.id,
    createdAt: item.createdAt,
    links: item.links,
    categories: item.categories,
    linkCount: item.links.length,
    categoryCount: item.categories.length,
  })).sort((left, right) => right.createdAt - left.createdAt);
};

export const appendRecoverySnapshot = (value: unknown, snapshot: RecoverySnapshot, limit = 5): RecoverySnapshot[] => normalizeRecoverySnapshots([snapshot, ...normalizeRecoverySnapshots(value)]).slice(0, Math.max(1, limit));

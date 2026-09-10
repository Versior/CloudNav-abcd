import type { HistorySnapshotMeta } from '../types.ts';

export interface HistorySnapshotInput {
  version: number;
  createdAt: number;
  links: unknown[];
  categories: unknown[];
}

export const createHistorySnapshot = (value: HistorySnapshotInput): HistorySnapshotMeta => ({
  id: `v${value.version}-${value.createdAt}`,
  version: Math.max(0, Math.floor(value.version)),
  createdAt: value.createdAt,
  linkCount: value.links.length,
  categoryCount: value.categories.length,
});

export const normalizeHistory = (value: unknown): HistorySnapshotMeta[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is HistorySnapshotMeta => !!item && typeof item === 'object' && typeof (item as HistorySnapshotMeta).id === 'string' && typeof (item as HistorySnapshotMeta).version === 'number' && typeof (item as HistorySnapshotMeta).createdAt === 'number')
    .map(item => ({
      id: item.id,
      version: Math.max(0, Math.floor(item.version)),
      createdAt: item.createdAt,
      linkCount: Math.max(0, Math.floor(item.linkCount || 0)),
      categoryCount: Math.max(0, Math.floor(item.categoryCount || 0)),
    }))
    .sort((left, right) => right.version - left.version || right.createdAt - left.createdAt)
    .slice(0, 30);
};

export const appendHistory = (history: unknown, entry: HistorySnapshotMeta): HistorySnapshotMeta[] => normalizeHistory([entry, ...normalizeHistory(history)]);

import type { LinkItem } from '../types';

/** 排序键：手动顺序 / 标题 / 创建时间 / 最近访问 / 访问热度。 */
export type SortKey = 'manual' | 'title' | 'created' | 'visited' | 'visits';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export const DEFAULT_SORT: SortConfig = { key: 'manual', direction: 'asc' };

export const SORT_OPTIONS: Array<{ key: SortKey; label: string; hint: string }> = [
  { key: 'manual', label: '手动顺序', hint: '拖拽或整理模式调整' },
  { key: 'title', label: '标题', hint: '按名称字母序' },
  { key: 'created', label: '添加时间', hint: '按收录时间' },
  { key: 'visited', label: '最近访问', hint: '按上次打开时间' },
  { key: 'visits', label: '访问热度', hint: '按累计打开次数' },
];

const eq = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });

/** 手动顺序：显式 order 优先，缺失时退回创建时间，保证稳定可预测。 */
const manualValue = (link: LinkItem) => (typeof link.order === 'number' ? link.order : link.createdAt);

/**
 * 应用排序。手动模式下保持传入顺序（拖拽结果），其余键按方向排序，
 * 值相同时回落到手动顺序，避免同一数据反复重排抖动。
 */
export const applySort = (links: LinkItem[], config: SortConfig): LinkItem[] => {
  if (config.key === 'manual') return config.direction === 'asc' ? [...links] : [...links].reverse();

  const factor = config.direction === 'asc' ? 1 : -1;
  const compare = (a: LinkItem, b: LinkItem): number => {
    switch (config.key) {
      case 'title':
        return eq(a.title, b.title) * factor;
      case 'created':
        return (a.createdAt - b.createdAt) * factor;
      case 'visited':
        return ((a.lastVisitedAt || 0) - (b.lastVisitedAt || 0)) * factor;
      case 'visits':
        return ((a.visitCount || 0) - (b.visitCount || 0)) * factor;
      default:
        return 0;
    }
  };

  return [...links].sort((a, b) => compare(a, b) || (manualValue(a) - manualValue(b)));
};

const SORT_KEYS: SortKey[] = ['manual', 'title', 'created', 'visited', 'visits'];

/** 读取持久化排序偏好，非法值回落到默认，避免脏数据弄崩首屏。 */
export const normalizeSortConfig = (value: unknown): SortConfig => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SORT };
  const raw = value as Record<string, unknown>;
  const key = SORT_KEYS.includes(raw.key as SortKey) ? raw.key as SortKey : DEFAULT_SORT.key;
  const direction: SortDirection = raw.direction === 'desc' ? 'desc' : raw.direction === 'asc' ? 'asc' : DEFAULT_SORT.direction;
  return { key, direction };
};

/** 只有手动模式允许拖拽，其余排序下拖拽会与排序规则冲突。 */
export const canReorder = (config: SortConfig) => config.key === 'manual';

/**
 * 把拖拽结果写回 order：只重排索引区间，其余卡片保持原值，
 * 避免整表 order 被反复覆盖造成无意义的云端写入。
 */
export const applyReorder = (links: LinkItem[], draggedId: string, targetId: string): LinkItem[] | null => {
  const from = links.findIndex(link => link.id === draggedId);
  const to = links.findIndex(link => link.id === targetId);
  if (from < 0 || to < 0 || from === to) return null;

  const next = [...links];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);

  const byId = new Map(next.map((link, index) => [link.id, index]));
  return links.map(link => {
    const index = byId.get(link.id);
    return index === undefined || index === link.order ? link : { ...link, order: index };
  });
};

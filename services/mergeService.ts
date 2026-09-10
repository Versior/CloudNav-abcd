import type { Category, LinkItem } from '../types.ts';

export interface MergeData {
  links: LinkItem[];
  categories: Category[];
}

export interface MergeResult {
  data: MergeData;
  conflicts: number;
  linkConflicts: number;
  categoryConflicts: number;
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
};

const same = (left: unknown, right: unknown) => JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const chooseConflict = (local: any, remote: any) => {
  const localUpdatedAt = typeof local?.updatedAt === 'number' ? local.updatedAt : 0;
  const remoteUpdatedAt = typeof remote?.updatedAt === 'number' ? remote.updatedAt : 0;
  return remoteUpdatedAt >= localUpdatedAt ? remote : local;
};

const mergeRecord = <T extends { id: string }>(base: T | undefined, local: T, remote: T): { value: T; conflicts: number } => {
  const keys = new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)]);
  const value: Record<string, unknown> = { ...local };
  let conflicts = 0;
  for (const key of keys) {
    if (key === 'id') continue;
    const baseValue = base?.[key as keyof T];
    const localValue = local[key as keyof T];
    const remoteValue = remote[key as keyof T];
    if (same(localValue, baseValue)) value[key] = remoteValue;
    else if (same(remoteValue, baseValue) || same(localValue, remoteValue)) value[key] = localValue;
    else if (key === 'updatedAt') value[key] = Math.max(Number(localValue || 0), Number(remoteValue || 0)) || undefined;
    else {
      value[key] = chooseConflict(local, remote)[key];
      conflicts += 1;
    }
  }
  return { value: value as T, conflicts };
};

const mergeCollection = <T extends { id: string }>(base: T[], local: T[], remote: T[]) => {
  const baseById = new Map(base.map(item => [item.id, item]));
  const localById = new Map(local.map(item => [item.id, item]));
  const remoteById = new Map(remote.map(item => [item.id, item]));
  const order = Array.from(new Set([...base, ...local, ...remote].map(item => item.id)));
  const output: T[] = [];
  let conflicts = 0;

  for (const id of order) {
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    if (!localItem && !remoteItem) continue;
    if (!localItem) {
      if (baseItem && same(remoteItem, baseItem)) continue;
      output.push(remoteItem!);
      continue;
    }
    if (!remoteItem) {
      if (baseItem && same(localItem, baseItem)) continue;
      output.push(localItem);
      continue;
    }
    if (!baseItem) {
      const merged = mergeRecord(undefined, localItem, remoteItem);
      output.push(merged.value);
      conflicts += merged.conflicts;
      continue;
    }
    const merged = mergeRecord(baseItem, localItem, remoteItem);
    output.push(merged.value);
    conflicts += merged.conflicts;
  }
  return { output, conflicts };
};

export const mergeThreeWay = (base: MergeData, local: MergeData, remote: MergeData): MergeResult => {
  const links = mergeCollection(base.links, local.links, remote.links);
  const categories = mergeCollection(base.categories, local.categories, remote.categories);
  return {
    data: { links: links.output, categories: categories.output },
    conflicts: links.conflicts + categories.conflicts,
    linkConflicts: links.conflicts,
    categoryConflicts: categories.conflicts,
  };
};

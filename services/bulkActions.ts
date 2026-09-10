import type { LinkItem } from '../types.ts';

export type BulkAction =
  | { type: 'move'; categoryId: string }
  | { type: 'addTags'; tags: string[] }
  | { type: 'removeTags'; tags: string[] }
  | { type: 'setPinned'; pinned: boolean }
  | { type: 'setStatus'; status: LinkItem['status'] }
  | { type: 'archive' };

type BulkLink = Pick<LinkItem, 'id'> & Partial<Omit<LinkItem, 'id'>>;

export const applyBulkAction = <T extends BulkLink>(links: T[], selectedIds: string[], action: BulkAction): T[] => {
  const selected = new Set(selectedIds);
  const tags = action.type === 'addTags' || action.type === 'removeTags' ? new Set(action.tags.map(tag => tag.trim()).filter(Boolean)) : null;

  return links.map(link => {
    if (!selected.has(link.id)) return link;
    if (action.type === 'move') return { ...link, categoryId: action.categoryId } as T;
    if (action.type === 'setPinned') return { ...link, pinned: action.pinned } as T;
    if (action.type === 'archive') return { ...link, status: 'archived' as const } as T;
    if (action.type === 'setStatus') return { ...link, status: action.status } as T;
    const currentTags = Array.isArray(link.tags) ? link.tags || [] : [];
    const nextTags = action.type === 'addTags'
      ? Array.from(new Set([...currentTags, ...(tags ? [...tags] : [])]))
      : currentTags.filter(tag => !tags?.has(tag));
    return { ...link, tags: nextTags } as T;
  });
};

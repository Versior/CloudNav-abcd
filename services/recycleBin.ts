import type { LinkItem } from '../types.ts';

type DeletableLink = Pick<LinkItem, 'id'> & Partial<Omit<LinkItem, 'id'>>;

export const softDeleteLinks = <T extends DeletableLink>(links: T[], ids: string[], deletedAt = Date.now()): T[] => {
  const selected = new Set(ids);
  return links.map(link => selected.has(link.id) ? { ...link, deletedAt } as T : link);
};

export const restoreLinks = <T extends DeletableLink>(links: T[], ids: string[]): T[] => {
  const selected = new Set(ids);
  return links.map(link => {
    if (!selected.has(link.id)) return link;
    const { deletedAt: _deletedAt, ...rest } = link;
    return rest as T;
  });
};

export const filterActiveLinks = <T extends DeletableLink>(links: T[]): T[] => links.filter(link => !link.deletedAt);

export const filterDeletedLinks = <T extends DeletableLink>(links: T[]): T[] => links.filter(link => !!link.deletedAt);

export const purgeExpiredLinks = <T extends DeletableLink>(links: T[], now = Date.now(), retentionMs = 30 * 24 * 60 * 60 * 1000): T[] => {
  const cutoff = now - Math.max(0, retentionMs);
  return links.filter(link => !link.deletedAt || link.deletedAt >= cutoff);
};

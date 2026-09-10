import { INBOX_ID } from '../types.ts';
import type { LinkItem } from '../types.ts';

export const isInboxLink = (link: Pick<LinkItem, 'categoryId'>) => link.categoryId === INBOX_ID;

export const getNormalLinks = (links: LinkItem[]) => links.filter(link => !link.deletedAt && !isInboxLink(link));

export const getInboxLinks = (links: LinkItem[]) => links.filter(link => !link.deletedAt && isInboxLink(link));

import { LinkItem, Category, DEFAULT_CATEGORIES, INITIAL_LINKS, INBOX_ID } from '../types';
import { LOCAL_STORAGE_KEY } from '../constants/storageKeys';

export interface LocalDataResult {
  links: LinkItem[];
  categories: Category[];
}

// 以 id 为键合并:云端为基,本地改动覆盖(尽量保住本地意图,不处理删除)
export const mergeById = (cloud: any[], local: any[]): any[] => {
  const map = new Map<string, any>();
  for (const item of (cloud || [])) map.set(item.id, item);
  for (const item of (local || [])) map.set(item.id, item);
  return Array.from(map.values());
};

export const loadFromLocal = (): LocalDataResult => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return { links: INITIAL_LINKS, categories: DEFAULT_CATEGORIES };

  try {
    const parsed = JSON.parse(stored);
    let loadedCategories = parsed.categories || DEFAULT_CATEGORIES;

    // 确保 Inbox 始终存在且为第一个分类
    if (!loadedCategories.some((c: Category) => c.id === INBOX_ID)) {
      loadedCategories = [{ id: INBOX_ID, name: '待整理', icon: 'Inbox' as any }, ...loadedCategories];
    }
    const inboxIdx = loadedCategories.findIndex((c: Category) => c.id === INBOX_ID);
    if (inboxIdx > 0) {
      const inbox = loadedCategories[inboxIdx];
      loadedCategories = [inbox, ...loadedCategories.filter((c: Category) => c.id !== INBOX_ID)];
    }

    // 确保"常用推荐"分类始终存在，并确保它是第一个分类
    if (!loadedCategories.some((c: Category) => c.id === 'common')) {
      loadedCategories = [
        { id: 'common', name: '常用推荐', icon: 'Star' },
        ...loadedCategories
      ];
    } else {
      const commonIndex = loadedCategories.findIndex((c: Category) => c.id === 'common');
      if (commonIndex > 0) {
        const commonCategory = loadedCategories[commonIndex];
        loadedCategories = [
          commonCategory,
          ...loadedCategories.slice(0, commonIndex),
          ...loadedCategories.slice(commonIndex + 1)
        ];
      }
    }

    // 检查是否有链接的categoryId不存在于当前分类中
    const validCategoryIds = new Set(loadedCategories.map((c: Category) => c.id));
    let loadedLinks = parsed.links || INITIAL_LINKS;
    loadedLinks = loadedLinks.map((link: LinkItem) =>
      !validCategoryIds.has(link.categoryId) ? { ...link, categoryId: 'common' } : link
    );

    return { links: loadedLinks, categories: loadedCategories };
  } catch {
    return { links: INITIAL_LINKS, categories: DEFAULT_CATEGORIES };
  }
};

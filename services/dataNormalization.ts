import type { Category, LinkItem } from '../types.ts';

/**
 * 已废弃的分类：规范化时连同其下链接一并移除。
 * - sub-search / sub-news：早期「搜索引擎」「即时资讯」
 * - dev / design / ent / ai：早期默认示例分类，仅含示例站点
 */
export const RETIRED_CATEGORY_IDS = ['sub-search', 'sub-news', 'dev', 'design', 'ent', 'ai'];

export const normalizeCategories = (value: unknown): Category[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const categories = source
    .filter((item): item is Category => !!item && typeof item === 'object' && typeof (item as Category).id === 'string' && typeof (item as Category).name === 'string')
    .filter(category => !RETIRED_CATEGORY_IDS.includes(category.id))
    .filter(category => {
      if (seen.has(category.id)) return false;
      seen.add(category.id);
      return true;
    });
  if (!seen.has('common')) categories.unshift({ id: 'common', name: '常用推荐', icon: 'Star' });
  return categories;
};

export const normalizeLinks = (value: unknown, categories: Category[] = []): LinkItem[] => {
  const categoryIds = new Set(categories.map(category => category.id));
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter(item => typeof item.id === 'string' && typeof item.title === 'string' && typeof item.url === 'string')
    .filter(item => !RETIRED_CATEGORY_IDS.includes(String(item.categoryId)))
    .filter(item => {
      const id = String(item.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(item => {
      const { credentials: _credentials, health: _health, ...rest } = item;
      const rawCategoryId = String(rest.categoryId || 'common');
      const categoryId = rawCategoryId === '__inbox__' || !categoryIds.has(rawCategoryId) ? 'common' : rawCategoryId;
      return { ...rest, categoryId } as LinkItem;
    });
};

export const normalizeAppData = (value: unknown) => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const categories = normalizeCategories(record.categories);
  const links = normalizeLinks(record.links, categories);
  return {
    links,
    categories,
    version: typeof record.version === 'number' && Number.isFinite(record.version) ? Math.max(0, Math.floor(record.version)) : 0,
    updatedAt: typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt) ? record.updatedAt : undefined,
  };
};

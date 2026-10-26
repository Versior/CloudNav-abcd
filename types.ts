export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon?: string;
  description?: string;
  categoryId: string;
  tags?: string[];
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number;
  pinned?: boolean;
  pinnedOrder?: number;
  order?: number;
  visitCount?: number;
  lastVisitedAt?: number;
  note?: string;
  status?: 'unread' | 'read' | 'favorite' | 'archived';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  password?: string;
  parentId?: string;
}

export type CardStyle = SiteSettings['cardStyle'];
/** 全局密度：同时控制书签卡片与侧栏分类的尺寸。 */
export type Density = 'compact' | 'cozy' | 'spacious';

export interface SiteSettings {
  title: string;
  navTitle: string;
  favicon: string;
  cardStyle: 'detailed' | 'simple' | 'list';
  /** 卡片与侧栏的尺寸档位，缺省视为 cozy。 */
  density?: Density;
  passwordExpiryDays: number;
}

export interface AppState {
  links: LinkItem[];
  categories: Category[];
  darkMode: boolean;
  settings?: SiteSettings;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIConfig {
  provider: AIProvider;
  baseUrl: string;
  model: string;
  hasApiKey?: boolean;
}

export type SearchMode = 'internal' | 'external';

export interface ExternalSearchSource {
  id: string;
  name: string;
  url: string;
  icon?: string;
  enabled: boolean;
  createdAt: number;
}

export interface SearchConfig {
  mode: SearchMode;
  externalSources: ExternalSearchSource[];
  selectedSource?: ExternalSearchSource | null;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'common', name: '常用推荐', icon: 'Star' },
];


/** 首次使用的示例数据：只保留少数常用站点，不再预置分类与示例站群。 */
export const INITIAL_LINKS: LinkItem[] = [
  { id: 's1', title: 'Google', url: 'https://www.google.com', categoryId: 'common', createdAt: Date.now(), description: '全球最大的搜索引擎', pinned: true, icon: 'https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://www.google.com' },
  { id: 's2', title: '百度', url: 'https://www.baidu.com', categoryId: 'common', createdAt: Date.now(), description: '国内主流搜索引擎', pinned: true, icon: 'https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://www.baidu.com' },
  { id: 'n1', title: 'IT之家', url: 'https://www.ithome.com', categoryId: 'common', createdAt: Date.now(), description: '数码科技资讯平台', pinned: true, icon: 'https://t3.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=128&url=https://www.ithome.com' },
];

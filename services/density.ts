import type { CardStyle, Density } from '../types';

/**
 * 密度 → 具体尺寸。
 *
 * 一个档位同时决定：
 * - 网格列数（书签卡片大小）
 * - 卡片内边距与图标尺寸
 * - 侧栏分类行高与字号
 *
 * 集中在此处，避免尺寸散落在各组件里导致档位失灵。
 */

export interface DensityTokens {
  /** 详情视图的网格列数（响应式断点） */
  gridDetailed: string;
  /** 简约视图的网格列数 */
  gridSimple: string;
  /** 列表视图（始终单列，仅控制间距） */
  gridList: string;
  /** 图标视图（macOS 启动台风格） */
  gridIcon: string;
  /** 图标视图里图标本体的尺寸 */
  launchIcon: string;
  /** 卡片内边距（详情视图） */
  cardPadding: string;
  /** 行内边距（简约 / 列表视图） */
  rowPadding: string;
  /** 卡片间距 */
  gridGap: string;
  /** 图标盒子尺寸 */
  iconBox: string;
  /** 标题字号 */
  titleSize: string;
  /** 描述字号 */
  descSize: string;
  /** 侧栏行高（纵向内边距） */
  navItemPadding: string;
  /** 侧栏字号 */
  navItemText: string;
  /** 侧栏图标尺寸 */
  navIconSize: number;
}

export const DENSITY_TOKENS: Record<Density, DensityTokens> = {
  compact: {
    gridDetailed: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
    gridSimple: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8',
    gridList: 'gap-1',
    gridIcon: 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12',
    launchIcon: 'h-12 w-12 rounded-[14px]',
    cardPadding: 'px-3 py-2.5',
    rowPadding: 'px-3 py-1.5',
    gridGap: 'gap-2',
    iconBox: 'h-7 w-7 rounded-[8px]',
    titleSize: 'text-[12px]',
    descSize: 'text-[11px]',
    navItemPadding: 'py-1.5',
    navItemText: 'text-[12px]',
    navIconSize: 13,
  },
  cozy: {
    gridDetailed: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    gridSimple: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    gridList: 'gap-1.5',
    gridIcon: 'grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10',
    launchIcon: 'h-14 w-14 rounded-[16px]',
    cardPadding: 'px-3.5 py-3',
    rowPadding: 'px-3.5 py-2',
    gridGap: 'gap-3',
    iconBox: 'h-9 w-9 rounded-[10px]',
    titleSize: 'text-[13px]',
    descSize: 'text-[12px]',
    navItemPadding: 'py-2',
    navItemText: 'text-[13px]',
    navIconSize: 15,
  },
  spacious: {
    gridDetailed: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
    gridSimple: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    gridList: 'gap-2',
    gridIcon: 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
    launchIcon: 'h-16 w-16 rounded-[18px]',
    cardPadding: 'px-4 py-3.5',
    rowPadding: 'px-4 py-2.5',
    gridGap: 'gap-4',
    iconBox: 'h-11 w-11 rounded-[12px]',
    titleSize: 'text-[14px]',
    descSize: 'text-[13px]',
    navItemPadding: 'py-2.5',
    navItemText: 'text-[14px]',
    navIconSize: 17,
  },
};

export const DENSITY_OPTIONS: Array<{ value: Density; label: string; hint: string }> = [
  { value: 'compact', label: '紧凑', hint: '一屏看更多' },
  { value: 'cozy', label: '标准', hint: '默认' },
  { value: 'spacious', label: '宽松', hint: '图标更大' },
];

/** 归一化：非法值回落到 cozy。 */
export const normalizeDensity = (value: unknown): Density =>
  value === 'compact' || value === 'spacious' ? value : 'cozy';

/** 按卡片形态取网格类。 */
export const gridClassFor = (density: Density, style: CardStyle): string => {
  const t = DENSITY_TOKENS[density];
  if (style === 'icon') return `grid ${t.gridIcon} gap-x-2 gap-y-6`;
  if (style === 'list') return `grid grid-cols-1 ${t.gridList}`;
  if (style === 'simple') return `grid ${t.gridSimple} ${t.gridGap}`;
  return `grid ${t.gridDetailed} ${t.gridGap}`;
};

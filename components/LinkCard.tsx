import React from 'react';
import { Check, Edit2, GripHorizontal, GripVertical, Pin } from 'lucide-react';
import type { CardStyle, Density, LinkItem } from '../types';
import { DENSITY_TOKENS } from '../services/density';

interface LinkCardProps {
  link: LinkItem;
  cardStyle: CardStyle;
  /** 全局密度，控制图标与字号。 */
  density?: Density;
  /** 整理模式：显示选择框并禁用跳转。 */
  selectable?: boolean;
  selected?: boolean;
  /** 显示拖拽把手（仅手动排序）。 */
  draggable?: boolean;
  /** dnd-kit 的 activator ref：挂到把手上才能按住把手拖动。 */
  activatorRef?: (node: HTMLElement | null) => void;
  onOpen: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onToggleSelect?: (id: string) => void;
  onContextMenu?: (event: React.MouseEvent, link: LinkItem) => void;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * 生成 favicon 候选地址。
 *
 * 顺序：站点自建图标 → 自家边缘代理。
 *
 * 为什么最后一定要走 /api/favicon 而不是 Google：
 * 项目部署在 Cloudflare，但浏览器在用户侧。国内网络访问不到 gstatic，
 * 直连 Google 会导致图标大面积加载失败、全部回落成首字母。
 * 交给边缘代理后，浏览器只请求同域接口，可达性由 Cloudflare 保证。
 */
const fallbackIcons = (url: string): string[] => {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    return [
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      `/api/favicon?url=${encodeURIComponent(origin)}`,
    ];
  } catch {
    return [];
  }
};

/**
 * 图标底座：优先用链接自带 icon；缺失或加载失败时依次尝试 favicon 服务；
 * 全部不可用才退回首字母，保证任何情况下都有可见标识。
 */
const Favicon: React.FC<{ link: LinkItem; size: 'sm' | 'md'; density: Density }> = ({ link, size, density }) => {
  const tokens = DENSITY_TOKENS[density];
  // 详情视图用密度档位，简约/列表用小一号
  const box = size === 'md' ? tokens.iconBox : density === 'compact' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-md';
  const img = size === 'md' ? (density === 'spacious' ? 'h-5 w-5' : 'h-4 w-4') : 'h-4 w-4';

  const candidates = React.useMemo(() => {
    const list = fallbackIcons(link.url);
    return link.icon ? [link.icon, ...list] : list;
  }, [link.icon, link.url]);

  const [index, setIndex] = React.useState(0);
  React.useEffect(() => { setIndex(0); }, [link.icon, link.url]);

  // 有些站点返回 404 HTML，图片既不显示也不触发 onError，会长期空白。
  // 因此给每个候选加超时，超时就换下一个，最终回落到首字母。
  React.useEffect(() => {
    if (index >= candidates.length) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLImageElement>(`img[data-fav="${index}-${link.id}"]`);
      if (el && el.complete && el.naturalWidth > 0) return;
      setIndex(current => current + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [index, candidates.length, link.id]);

  const src = candidates[index] || '';

  if (!src) {
    return (
      <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-accent-soft to-sunken ring-1 ring-line/60`}>
        <span className="text-[12px] font-semibold text-accent-ink">{(link.title || '?').slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }

  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-accent-soft/70 to-sunken ring-1 ring-line/60`}>
      <img
        key={src}
        data-fav={`${index}-${link.id}`}
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${img} object-contain`}
        onError={() => setIndex(current => current + 1)}
      />
    </span>
  );
};

/** 由站点名生成稳定色相，保证同一站点永远同色。 */
/*
 * 首字母兜底配色。
 *
 * 之前是 charCode 哈希取 0–360 全色相，565 个图标同时出现时五颜六色、
 * 明暗不一，整体非常吵。改成一组精选的、低饱和的固定色板：
 * - 色相只在这几个"相邻但不重复"的区间里轮转
 * - 饱和度与明度统一，保证白字对比度一致
 * 观感上像 macOS 的一组应用图标，而不是打翻的调色盘。
 */
const ICON_PALETTE: Array<[number, number, number]> = [
  [211, 92, 56], // 系统蓝
  [199, 78, 48], // 青
  [173, 62, 42], // 绿松
  [152, 55, 40], // 绿
  [38, 88, 52],  // 琥珀
  [14, 78, 54],  // 橙
  [350, 68, 55], // 玫红
  [268, 58, 56], // 紫
  [240, 42, 54], // 靛
  [220, 14, 46], // 石板灰
];

/** 稳定取色：同一站点永远同一个色块。 */
const paletteOf = (seed: string): [number, number, number] => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return ICON_PALETTE[h % ICON_PALETTE.length];
};

/**
 * 桌面图标：macOS 应用图标的感觉——大圆角方块、彩色渐变底、居中 favicon。
 *
 * 底色按站点名生成色相，所以每个站点都有自己的颜色；
 * favicon 加载不出来时露出白色首字母，而不是一张统一的灰色占位图。
 */
const LaunchIcon: React.FC<{ link: LinkItem; density: Density }> = ({ link, density }) => {
  const tokens = DENSITY_TOKENS[density];
  const candidates = React.useMemo(() => {
    const list = fallbackIcons(link.url);
    return link.icon ? [link.icon, ...list] : list;
  }, [link.icon, link.url]);
  const [index, setIndex] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => { setIndex(0); setLoaded(false); }, [link.icon, link.url]);

  const src = candidates[index] || '';
  const label = (link.title || link.url).trim();
  const initial = label.slice(0, 1).toUpperCase();
  const [hue, sat, light] = paletteOf(label || link.url);

  return (
    <span
      className={`${tokens.launchIcon} relative flex shrink-0 items-center justify-center overflow-hidden shadow-[0_2px_8px_-1px_hsl(240_30%_30%/0.22),0_1px_2px_hsl(240_30%_30%/0.14)]`}
    >
      {/* 兜底底色：只在图标没加载出来时才显示。
          用极浅的同色系底 + 深色字母，像 macOS 里没有图标的空 Application，
          而不是一整块高饱和色卡——几百个排在一起会很吵。 */}
      {!loaded ? (
        <>
          <span
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, hsl(${hue} ${Math.round(sat * 0.55)}% 96%), hsl(${hue} ${Math.round(sat * 0.6)}% 88%))` }}
          />
          <span
            className="absolute inset-0 grid place-items-center text-[22px] font-semibold tracking-tight"
            style={{ color: `hsl(${hue} ${sat}% ${Math.max(28, light - 18)}%)` }}
          >
            {initial}
          </span>
        </>
      ) : null}
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`relative h-[58%] w-[58%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={event => {
            if (!event.currentTarget.naturalWidth) {
              setIndex(current => current + 1);
              return;
            }
            setLoaded(true);
          }}
          onError={() => setIndex(current => current + 1)}
        />
      ) : null}
    </span>
  );
};
const PinMark: React.FC<{ visible?: boolean }> = ({ visible }) =>
  visible ? <Pin size={10} className="shrink-0 fill-accent text-accent" /> : null;

/** 选中标记：卡片内左侧勾选框，不遮挡图标与标题。 */
const SelectBox: React.FC<{ selected?: boolean }> = ({ selected }) => (
  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${selected
    ? 'border-accent bg-accent text-white'
    : 'border-line-strong bg-raised'}`}>
    {selected ? <Check size={10} strokeWidth={3.5} /> : null}
  </span>
);

const LinkCard: React.FC<LinkCardProps> = ({
  link, cardStyle, selectable, selected, draggable, density = 'cozy',
  onOpen, onEdit, onToggleSelect, onContextMenu, activatorRef,
}) => {
  const tokens = DENSITY_TOKENS[density];
  const handleClick = (event: React.MouseEvent) => {
    if (selectable) {
      event.preventDefault();
      onToggleSelect?.(link.id);
      return;
    }
    onOpen(link);
  };

  const handleKey = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event as unknown as React.MouseEvent);
    }
  };

  // 卡片外壳统一走 .card-surface，颜色全部来自设计令牌
  const shell = 'group relative card-surface ' +
    (selected ? '!border-accent ring-1 ring-accent/25' : '');

  const actions = !selectable && (
    <div className="absolute right-1.5 top-1.5 hidden items-center gap-1 group-hover:flex group-focus-within:flex">
      <button
        type="button"
        onClick={event => { event.stopPropagation(); onEdit(link); }}
        title="编辑"
        className="rounded-md bg-raised/95 p-1 text-ink-muted ring-1 ring-line transition-colors hover:text-accent"
      >
        <Edit2 size={11} />
      </button>
    </div>
  );

  // 把手作为卡片内左侧一列，不溢出、不遮挡内容
  // 把手默认隐藏，卡片悬停或聚焦时才浮现；宽度为 0 不占布局，避免平时留出一条缝
  const dragHandle = draggable && (
    <span
      ref={activatorRef}
      role="button"
      tabIndex={-1}
      aria-label="拖动排序"
      className="flex w-0 shrink-0 cursor-grab touch-none items-center justify-center self-stretch overflow-visible text-ink-muted/0 transition-colors group-hover:text-ink-muted/60 group-focus-within:text-ink-muted/60 hover:!text-accent active:cursor-grabbing"
    >
      <GripVertical size={12} />
    </span>
  );

  // 置顶标记不再常显：只在卡片悬停/聚焦时浮现，避免每张卡右上角挂个蓝钉子
  const pinRow = (
    <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <PinMark visible={link.pinned} />
    </span>
  );

  // icon：macOS 启动台风格——无卡片底，大圆角图标居中，标题压在图标下方
  if (cardStyle === 'icon') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKey}
        onContextMenu={event => onContextMenu?.(event, link)}
        className="group relative flex flex-col items-center gap-1.5 px-1 py-2"
      >
        {selectable && <div className="absolute left-1 top-1 z-10"><SelectBox selected={selected} /></div>}
        {/* 拖拽把手：只在手动排序时出现，悬停才显形，不占布局 */}
        {/* 图标视图不放把手：把手下压会盖住图标。整张卡即拖拽区（8px 阈值，
            单击照常打开链接），拖拽功能保留但不占视觉空间。 */}
        {draggable && <span ref={activatorRef} className="hidden" aria-hidden="true" />}
        <LaunchIcon link={link} density={density} />
        <span className="flex w-full items-center justify-center gap-1">
          {link.pinned ? <Pin size={9} className="shrink-0 fill-accent text-accent" /> : null}
          <span className="min-w-0 truncate text-center text-[12px] font-medium text-ink">{link.title}</span>
        </span>
      </div>
    );
  }

  if (cardStyle === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKey}
        onContextMenu={event => onContextMenu?.(event, link)}
        className={`${shell} flex items-center gap-2.5 ${tokens.rowPadding}`}
      >
        {dragHandle}
        {selectable && <SelectBox selected={selected} />}
        <Favicon link={link} size="sm" density={density} />
        <span className={`min-w-0 flex-1 truncate ${tokens.titleSize} font-medium text-ink`}>{link.title}</span>
        {pinRow}
        <span className="hidden min-w-0 max-w-[40%] truncate text-[11px] text-ink-muted sm:block">{hostOf(link.url)}</span>
        {actions}
      </div>
    );
  }

  if (cardStyle === 'simple') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKey}
        onContextMenu={event => onContextMenu?.(event, link)}
        className={`${shell} flex items-center gap-2 ${tokens.rowPadding}`}
      >
        {dragHandle}
        {selectable && <SelectBox selected={selected} />}
        <Favicon link={link} size="sm" density={density} />
        <span className={`min-w-0 flex-1 truncate ${tokens.titleSize} font-medium text-ink`}>{link.title}</span>
        {pinRow}
        {actions}
      </div>
    );
  }

  // detailed：把手列 + 图标 + 标题 + 描述（两行）+ 最多 3 标签，撑满格子高度保证同行等高
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      onContextMenu={event => onContextMenu?.(event, link)}
      className={`${shell} flex h-full items-stretch gap-1 ${tokens.cardPadding}`}
    >
      {dragHandle}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start gap-3">
          <Favicon link={link} size="md" density={density} />
          <div className="flex min-w-0 flex-1 flex-col self-stretch">
            <div className="flex items-center gap-1.5">
              {selectable && <SelectBox selected={selected} />}
              <span className={`min-w-0 flex-1 truncate ${tokens.titleSize} font-semibold tracking-tight text-ink`}>{link.title}</span>
              {pinRow}
            </div>
            <p className={`mt-1.5 line-clamp-2 min-h-[2.1em] ${tokens.descSize} leading-relaxed text-ink-soft`}>
              {link.description || hostOf(link.url)}
            </p>
            {link.tags?.length ? (
              <div className="mt-auto flex gap-1.5 overflow-hidden pt-2">
                {link.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="shrink-0 rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-soft">{tag}</span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {actions}
    </div>
  );
};

export default React.memo(LinkCard);

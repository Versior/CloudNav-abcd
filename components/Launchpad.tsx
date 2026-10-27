import React from 'react';
import type { Density, LinkItem } from '../types';
import { DENSITY_TOKENS } from '../services/density';

/**
 * macOS 底部 Dock / 启动台。
 *
 * 显示"常用点击"的网站：按 visitCount 排序，没有访问记录时按置顶 + 添加时间兜底，
 * 保证新用户也能看到一组可用入口，而不是空 Dock。
 *
 * 纯展示组件：排序在外部算好传进来，这里只负责渲染与 hover 放大效果。
 */

interface LaunchpadProps {
  links: LinkItem[];
  density?: Density;
  /** 最多显示几个 */
  limit?: number;
  onOpen: (link: LinkItem) => void;
  onEdit: (link: LinkItem) => void;
  onContextMenu: (event: React.MouseEvent, link: LinkItem) => void;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/*
 * Dock 图标兜底配色：与桌面图标共用同一组低饱和色板，
 * 避免 Dock 和网格出现两套风格。
 */
const ICON_PALETTE: Array<[number, number, number]> = [
  [211, 92, 56],
  [199, 78, 48],
  [173, 62, 42],
  [152, 55, 40],
  [38, 88, 52],
  [14, 78, 54],
  [350, 68, 55],
  [268, 58, 56],
  [240, 42, 54],
  [220, 14, 46],
];

const paletteOf = (seed: string): [number, number, number] => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return ICON_PALETTE[h % ICON_PALETTE.length];
};

/**
 * favicon 候选地址。
 *
 * 1. 站点自己的 /favicon.ico —— 最准
 * 2. gstatic faviconV2 —— Google 新版服务，覆盖率远高于"只试站点根路径"，
 *    解决大量站点图标加载不出来的问题
 */
const faviconCandidates = (url: string): string[] => {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    return [
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(origin)}&size=128`,
    ];
  } catch {
    return [];
  }
};

/**
 * Dock 图标：macOS 那种"实心圆角方块 + 居中图形"。
 *
 * 关键点：favicon 加载失败时不能留白或显示统一占位图——那会让整排图标长得一样。
 * 这里按站点名生成色相，画出彩色首字母图标，每个站点都有自己的辨识度。
 */
const DockIcon: React.FC<{ link: LinkItem; size: string }> = ({ link, size }) => {
  const candidates = React.useMemo(() => {
    const list = faviconCandidates(link.url);
    return link.icon ? [link.icon, ...list] : list;
  }, [link.icon, link.url]);
  const [index, setIndex] = React.useState(0);
  const [broken, setBroken] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => { setIndex(0); setBroken(false); setLoaded(false); }, [link.icon, link.url]);

  // 超时兜底：favicon 服务有时会挂起不响应，不能让占位符一直停在那里
  React.useEffect(() => {
    if (loaded || broken) return;
    const timer = window.setTimeout(() => setBroken(true), 4000);
    return () => window.clearTimeout(timer);
  }, [loaded, broken, index]);

  const src = broken ? '' : (candidates[index] || '');
  const label = (link.title || hostOf(link.url) || '?').trim();
  const letter = label.slice(0, 1).toUpperCase();
  const [hue, sat, light] = paletteOf(label || link.url);

  /** 换下一个候选；都试过了就彻底放弃，交给首字母兜底。 */
  const nextCandidate = () => {
    setLoaded(false);
    setIndex(current => {
      if (current + 1 < candidates.length) return current + 1;
      setBroken(true);
      return current;
    });
  };

  return (
    <span className={`${size} relative flex items-center justify-center overflow-hidden shadow-[0_2px_6px_-1px_hsl(240_30%_20%/0.28),0_1px_2px_hsl(240_30%_20%/0.18)]`}>
      {/* 彩色底：每个站点一个色相，加载失败时也有辨识度 */}
      <span
        className="absolute inset-0"
        style={{ background: `linear-gradient(160deg, hsl(${hue} ${sat}% ${light + 8}%), hsl(${hue} ${sat}% ${light - 6}%))` }}
      />
      {/* 顶部高光，做出 macOS 图标的搪瓷感 */}
      <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/45 to-transparent" />
      {/* 首字母只在图标没加载出来时显示：favicon 多为透明 PNG，
          常驻会让字母从透明处透出，看起来像压在 logo 上。 */}
      {!loaded ? (
        <span className="absolute inset-0 grid place-items-center text-[22px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
          {letter}
        </span>
      ) : null}
      {src && !broken ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`relative h-[62%] w-[62%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={event => {
            // 有些站点返回 HTML/空图，浏览器不报错但没有实际像素，视同失败
            if (!event.currentTarget.naturalWidth) nextCandidate();
            else setLoaded(true);
          }}
          onError={nextCandidate}
        />
      ) : null}
    </span>
  );
};

const Launchpad: React.FC<LaunchpadProps> = ({
  links, density = 'cozy', limit = 12, onOpen, onEdit, onContextMenu,
}) => {
  const tokens = DENSITY_TOKENS[density];
  if (!links.length) return null;
  const items = links.slice(0, limit);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center px-4">
      <div className="dock-glass pointer-events-auto flex max-w-full items-end gap-0.5 overflow-x-auto rounded-[18px] px-2 py-1.5">
        {items.map(link => (
          <button
            key={link.id}
            type="button"
            onClick={() => onOpen(link)}
            onContextMenu={event => onContextMenu(event, link)}
            title={`${link.title}${link.visitCount ? ` · 已访问 ${link.visitCount} 次` : ''}\n${hostOf(link.url)}`}
            className="dock-item group relative flex w-[62px] shrink-0 flex-col items-center gap-1 rounded-[10px] px-0.5 pb-1 pt-1 outline-none"
          >
            <DockIcon link={link} size={tokens.launchIcon} />
            <span className="w-full truncate text-center text-[10px] leading-tight text-ink-soft dark:text-white/90 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
              {link.title}
            </span>
            {/* 运行指示点：macOS Dock 的做法 */}
            <span className={`absolute bottom-0 h-[3px] w-[3px] rounded-full ${link.pinned ? 'bg-white/85' : 'bg-transparent'}`} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(Launchpad);

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

const fallbackIcons = (url: string): string[] => {
  try {
    const host = new URL(url).hostname;
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      `${new URL(url).origin}/favicon.ico`,
    ];
  } catch {
    return [];
  }
};

/** Dock 图标：比卡片里更大更实，带 macOS 那种光泽与投影。 */
const DockIcon: React.FC<{ link: LinkItem; size: string }> = ({ link, size }) => {
  const candidates = React.useMemo(() => {
    const list = fallbackIcons(link.url);
    return link.icon ? [link.icon, ...list] : list;
  }, [link.icon, link.url]);
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => { setIndex(0); }, [link.icon, link.url]);

  const src = candidates[index] || '';
  const initial = (link.title || '?').trim().slice(0, 1).toUpperCase();

  return (
    <span className={`${size} relative flex items-center justify-center overflow-hidden shadow-[0_3px_10px_-2px_hsl(240_30%_25%/0.28),0_1px_3px_hsl(240_30%_25%/0.18)]`}>
      <span className="absolute inset-0 bg-gradient-to-br from-white to-[hsl(240_20%_90%)] dark:from-[hsl(240_8%_28%)] dark:to-[hsl(240_10%_18%)]" />
      <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/75 to-transparent dark:from-white/14" />
      {src ? (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="relative h-[60%] w-[60%] object-contain"
          onError={() => setIndex(current => current + 1)}
        />
      ) : (
        <span className="relative text-[20px] font-semibold text-ink-soft">{initial}</span>
      )}
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
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-4">
      <div className="dock-glass pointer-events-auto flex max-w-full items-end gap-1 overflow-x-auto rounded-2xl px-2.5 py-2">
        {items.map(link => (
          <button
            key={link.id}
            type="button"
            onClick={() => onOpen(link)}
            onContextMenu={event => onContextMenu(event, link)}
            onDoubleClick={() => onEdit(link)}
            title={`${link.title}${link.visitCount ? ` · 已访问 ${link.visitCount} 次` : ''}\n${hostOf(link.url)}`}
            className="dock-item group relative flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-1 pb-0.5 pt-1 outline-none"
          >
            <DockIcon link={link} size={tokens.launchIcon} />
            <span className="w-full truncate text-center text-[10px] leading-tight text-ink-soft">
              {link.title}
            </span>
            {/* 已打开/置顶的小圆点，macOS Dock 的做法 */}
            <span className={`absolute -bottom-0.5 h-1 w-1 rounded-full ${link.pinned ? 'bg-accent' : 'bg-transparent'}`} />
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(Launchpad);

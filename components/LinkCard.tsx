import React from 'react';
import { Check, Edit2, GripVertical, Pin } from 'lucide-react';
import type { CardStyle, LinkItem } from '../types';



interface LinkCardProps {
  link: LinkItem;
  cardStyle: CardStyle;
  /** 整理模式：显示选择框并禁用跳转。 */
  selectable?: boolean;
  selected?: boolean;
  /** 显示拖拽把手（仅手动排序）。 */
  draggable?: boolean;
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
 * 按优先级生成 favicon 候选地址。
 * Google 服务放最前：它会代抓并归一化成 png，避免站点返回 404 HTML 页面
 * 导致 <img> 既不显示也不触发 onError 的“卡死”情况。
 */
const fallbackIcons = (url: string): string[] => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      `${parsed.origin}/favicon.ico`,
    ];
  } catch {
    return [];
  }
};
const Favicon: React.FC<{ link: LinkItem; size: 'sm' | 'md' }> = ({ link, size }) => {
  const box = size === 'md' ? 'h-9 w-9 rounded-xl' : 'h-7 w-7 rounded-lg';
  const img = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  // 候选序列：原始图标（若有）→ Google 服务 → DuckDuckGo → 站点自身
  const candidates = React.useMemo(() => {
    const list = fallbackIcons(link.url);
    return link.icon ? [link.icon, ...list] : list;
  }, [link.icon, link.url]);

  const [index, setIndex] = React.useState(0);
  React.useEffect(() => { setIndex(0); }, [link.icon, link.url]);

  // 每个候选加超时：若 4.5s 内仍未加载成功（返回 404 HTML 的站点会既不显示
  // 也不触发 onError），就换下一个候选，最终回落到首字母。
  React.useEffect(() => {
    if (index >= candidates.length) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector<HTMLImageElement>(`img[data-fav="${index}-${link.id}"]`);
      // 已经成功加载（哪怕超过超时点）就不要打断它
      if (el && el.complete && el.naturalWidth > 0) return;
      setIndex(current => current + 1);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [index, candidates.length, link.id]);
  const src = candidates[index] || '';
  // 候选耗尽：退回首字母，保证永远有可见标识
  if (!src) {
    return (
      <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 ring-1 ring-slate-200/60 dark:bg-slate-700/60 dark:ring-slate-600/40`}>
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">{(link.title || '?').slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }

  return (
    <span className={`${box} flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 ring-1 ring-slate-200/60 dark:bg-slate-700/60 dark:ring-slate-600/40`}>
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

const PinMark: React.FC<{ visible?: boolean }> = ({ visible }) =>
  visible ? <Pin size={11} className="shrink-0 fill-blue-500 text-blue-500" /> : null;

/** 选中标记：卡片内左侧勾选框，不遮挡图标与标题。 */
const SelectBox: React.FC<{ selected?: boolean }> = ({ selected }) => (
  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${selected
    ? 'border-blue-500 bg-blue-500 text-white'
    : 'border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-800'}`}>
    {selected ? <Check size={10} strokeWidth={3.5} /> : null}
  </span>
);

const LinkCard: React.FC<LinkCardProps> = ({
  link, cardStyle, selectable, selected, draggable,
  onOpen, onEdit, onToggleSelect, onContextMenu,
}) => {
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

  const shell = 'group relative border bg-white transition-all dark:bg-slate-800/70 ' +
    (selected
      ? 'border-blue-400 shadow-sm dark:border-blue-500'
      : 'border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.35)] dark:border-slate-700/70 dark:hover:border-blue-600');

  const actions = !selectable && (
    <div className="absolute right-1.5 top-1.5 hidden items-center gap-1 group-hover:flex group-focus-within:flex">
      <button type="button" onClick={event => { event.stopPropagation(); onEdit(link); }} title="编辑" className="rounded-md bg-white/90 p-1 text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-blue-600 dark:bg-slate-700/90 dark:text-slate-300 dark:ring-slate-600">
        <Edit2 size={11} />
      </button>

    </div>
  );

  const dragHandle = draggable && (
    <span className="absolute -left-1 top-1/2 hidden -translate-y-1/2 cursor-grab items-center rounded-md bg-white p-1 text-slate-300 shadow-sm ring-1 ring-slate-200 group-hover:flex active:cursor-grabbing dark:bg-slate-700 dark:text-slate-500 dark:ring-slate-600">
      <GripVertical size={12} />
    </span>
  );

  if (cardStyle === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKey}
        onContextMenu={event => onContextMenu?.(event, link)}
        className={`${shell} flex items-center gap-3 rounded-xl px-3 py-2`}
      >
        {selectable && <SelectBox selected={selected} />}
        <Favicon link={link} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{link.title}</span>
        <PinMark visible={link.pinned} />
        <span className="hidden min-w-0 max-w-[40%] truncate text-[11px] text-slate-400 sm:block">{hostOf(link.url)}</span>
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
        className={`${shell} flex items-center gap-2 rounded-xl px-2.5 py-2`}
      >
        {selectable && <SelectBox selected={selected} />}
        {dragHandle}
        <Favicon link={link} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{link.title}</span>
        <PinMark visible={link.pinned} />
        {actions}
      </div>
    );
  }

  // detailed：图标 + 标题 + 描述（最多两行）+ 最多 3 个标签；撑满格子高度保证同行等高。
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      onContextMenu={event => onContextMenu?.(event, link)}
      className={`${shell} flex h-full flex-col rounded-2xl p-3.5`}
    >
      {selectable && <span className="mb-2 flex items-center gap-2"><SelectBox selected={selected} /><span className="text-[10px] text-slate-400">{selected ? '已选中' : '点击选择'}</span></span>}
      {dragHandle}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Favicon link={link} size="md" />
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{link.title}</span>
            <PinMark visible={link.pinned} />
          </div>
          {/* 固定两行高度：描述长短不再影响卡片高度，整行卡片对齐 */}
          <p className="mt-0.5 line-clamp-2 min-h-[2.1em] text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {link.description || hostOf(link.url)}
          </p>
          {link.tags?.length ? (
            <div className="mt-auto flex gap-1 overflow-hidden pt-1.5">
              {link.tags.slice(0, 3).map(tag => (
                <span key={tag} className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {actions}
    </div>
  );
};

export default React.memo(LinkCard);

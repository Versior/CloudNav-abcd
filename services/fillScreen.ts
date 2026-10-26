import React from 'react';

/**
 * 首屏自适应条目数。
 *
 * 目的：置顶页是默认落地页，如果只显示固定条数，宽屏下方会留出大片空白，
 * 看起来像"页面没做完"。这里按容器实际高度、卡片高度与列数算出能铺满
 * 首屏的条目数，并多留一行作为"还有更多"的暗示。
 *
 * 只读几何信息，不触发额外网络或轮询；容器尺寸变化（含窗口缩放、
 * 密度切换）时通过 ResizeObserver 重算。
 */

interface Options {
  /** 可用的条目总数 */
  total: number;
  /** 卡片高度（由密度决定） */
  cardHeight: number;
  /** 网格列数（由密度与视口决定） */
  columns: number;
  /** 网格行间距 */
  rowGap?: number;
  /** 至少显示多少条，避免极矮视口算出 0 */
  min?: number;
  /** 最多显示多少条，避免超长列表一次全渲染 */
  max?: number;
}

const DEFAULT_ROW_GAP = 12;
const DEFAULT_MIN = 6;
const DEFAULT_MAX = 240;

/**
 * 根据容器高度算出铺满首屏需要的条目数（向上取整到整行）。
 * 返回值始终是 `columns` 的整数倍，保证最后一行不留缺口。
 */
export const computeFillCount = (
  containerHeight: number,
  { total, cardHeight, columns, rowGap = DEFAULT_ROW_GAP, min = DEFAULT_MIN, max = DEFAULT_MAX }: Options,
): number => {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) return Math.min(total, min);
  if (!Number.isFinite(cardHeight) || cardHeight <= 0) return Math.min(total, min);

  const cols = Math.max(1, Math.floor(columns));
  // 每行占用高度 = 格子高 + 行间距
  const rowHeight = cardHeight + rowGap;
  // 刚好铺满可视高度即可：多算一行会顶出滚动条，看起来像"多塞了一行"
  const visibleRows = Math.max(1, Math.floor(containerHeight / rowHeight));
  const bounded = Math.max(min, Math.min(visibleRows * cols, max));
  // 向上取整到整行，避免最后一行只有半个
  const aligned = Math.ceil(bounded / cols) * cols;
  return Math.max(0, Math.min(total, aligned));
};

/**
 * 观察元素高度，返回 [回调 ref, 实时高度]。
 *
 * 用回调 ref 把元素存进 state：元素挂载/卸载都会触发重渲染，
 * 避免 useRef 在首次 effect 时仍为 null 导致测不到高度。
 */
export const useElementHeight = (): [(node: HTMLElement | null) => void, number] => {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const [height, setHeight] = React.useState(0);

  React.useEffect(() => {
    if (!node) return;
    const update = () => setHeight(node.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, height];
};

/**
 * 观察网格实际列数：数第一行有几个卡片，比解析 grid-template-columns 更可靠。
 * 返回 [回调 ref, 列数]。`resetKey` 变化时重新测量（密度/形态切换）。
 */
export const useGridColumns = (resetKey: unknown): [(node: HTMLElement | null) => void, number, number] => {
  const [node, setNode] = React.useState<HTMLElement | null>(null);
  const [columns, setColumns] = React.useState(1);
  /** 实测的格子高度：不同卡片形态高度差很多，必须实测不能估算。 */
  const [tileHeight, setTileHeight] = React.useState(0);

  React.useEffect(() => {
    if (!node) return;
    const measure = () => {
      // ref 可能挂在外层包装上，向下找到真正的网格容器（display: grid）
      const grid = getComputedStyle(node).display === 'grid'
        ? node
        : Array.from(node.querySelectorAll<HTMLElement>('*')).find(el => getComputedStyle(el).display === 'grid');
      if (!grid) return;
      const children = Array.from(grid.children) as HTMLElement[];
      if (!children.length) return;
      const top = children[0].getBoundingClientRect().top;
      let count = 0;
      for (const child of children) {
        if (Math.abs(child.getBoundingClientRect().top - top) < 3) count += 1;
        else break;
      }
      if (count > 0) setColumns(count);
      const h = Math.round(children[0].offsetHeight);
      if (h > 0) setTileHeight(h);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, resetKey]);

  return [setNode, columns, tileHeight];
};

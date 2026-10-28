/**
 * 首字母兜底图标的配色。
 *
 * 站点没有 favicon、或者 favicon 加载失败时，用一个「首字母方块」顶上。
 * 这个方块必须看起来像个图标，而不是像「没加载完的占位块」——
 * 所以用中深实心渐变底 + 白字，也就是 macOS 缺失应用图标的样子。
 *
 * 曾经用过两种都不对的方案：
 * 1. charCode 哈希取 0–360 全色相 → 565 个图标五颜六色、明暗不一，很吵。
 * 2. 极浅同色底 + 深色字母 → 在壁纸上几乎透明，只剩一个飘着的字母，
 *    和旁边真实 logo 的视觉重量完全不在一个层级。
 *
 * 现在所有色块用同一感知亮度（L* ≈ 46），只是色相不同：
 * 几百个排在一起有秩序感，白字对比度也统一在 5:1 以上。
 * 明度值是按 L* 反解出来的，改色相时不要手改明度。
 */
const ICON_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [211, 56, 44.5], // 蓝
  [196, 56, 36.4], // 青蓝
  [187, 56, 32.7], // 青
  [174, 56, 30.5], // 蓝绿
  [152, 56, 31.1], // 绿
  [138, 56, 31.3], // 草绿
  [22, 56, 41.2],  // 橙棕
  [8, 56, 47],     // 橙红
  [344, 56, 49.3], // 玫红
  [326, 56, 47.9], // 洋红
  [292, 56, 48.1], // 紫
  [264, 56, 56.4], // 蓝紫
  [244, 56, 59.3], // 靛
];

/** 稳定取色：同一站点永远同一个色块，与视图无关。 */
export const paletteOf = (seed: string): readonly [number, number, number] => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 100000;
  return ICON_PALETTE[h % ICON_PALETTE.length];
};

/**
 * 兜底底色：上亮下暗的同色系渐变。
 * 明度上下各偏移一点，让色块看起来像有厚度的实体，而不是一张纯色贴纸。
 */
export const iconGradient = (hue: number, sat: number, light: number): string =>
  `linear-gradient(160deg, hsl(${hue} ${sat + 4}% ${Math.min(62, light + 8)}%), hsl(${hue} ${sat - 4}% ${Math.max(18, light - 7)}%))`;

/**
 * 取图标上要显示的那个字。
 *
 * 不能直接 slice(0,1)：不少站点标题以 `【`、`#`、`(`、emoji、
 * 甚至一个全角逗号开头，直接取第一个字符会把标点当成图标显示出来，
 * 一排图标里夹着 `【` `#` `,` 非常像乱码。所以跳过非字母数字，
 * 取第一个「真正的字」。
 */
export const initialOf = (title: string, fallback = '?'): string => {
  const text = title.trim();
  if (!text) return fallback;
  const first = Array.from(text).find(ch => /[\p{L}\p{N}]/u.test(ch));
  return (first || text.slice(0, 1)).toUpperCase();
};

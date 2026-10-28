import React from 'react';

/**
 * favicon 候选地址：站点自建 → 自家边缘代理。
 *
 * 不在浏览器里直连 Google gstatic：项目部署在 Cloudflare，用户在国内
 * 访问不到 Google，会导致图标大面积加载失败、全部回落成首字母。
 * 走 /api/favicon 由边缘代抓，浏览器只请求同域接口。
 *
 * 顺序有意义：先站点自己的，再由代理兜底。
 */
export const faviconCandidates = (url: string): string[] => {
  try {
    const { origin } = new URL(url);
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
 * 单张图探测的超时。
 *
 * 实测站点自己的 /favicon.ico 大多在 0.2–2.8s 内返回，
 * 原来 4.5s 的串行超时纯属浪费——一个站卡住就要白等 4.5s 才试下一个。
 * 收到 3s：够慢站点返回，又不会让一个坏站拖住整批。
 */
const PROBE_TIMEOUT = 3000;

const probe = (src: string): Promise<string | null> =>
  new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), PROBE_TIMEOUT);
    // 部分站点会因为带了 referer 而拒绝返回图标
    image.referrerPolicy = 'no-referrer';
    image.onload = () => finish(image.naturalWidth > 0 ? src : null);
    image.onerror = () => finish(null);
    image.src = src;
  });

/**
 * 图标解析结果：null 表示还在探测，'' 表示全部失败（走首字母兜底）。
 */
export const useFaviconSrc = (candidates: string[]): string | null => {
  const [src, setSrc] = React.useState<string | null>(() => (candidates.length ? null : ''));
  // 用字符串做依赖，避免每次渲染新建的数组触发无限重跑
  const key = candidates.join('|');

  React.useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) {
      setSrc('');
      return;
    }

    let alive = true;
    setSrc(null);

    /*
     * 按优先级串行探测，第一个成功即止。
     *
     * 试过并行（全部候选同时发），结果更糟：几百张卡片 × 3 个候选
     * 瞬间打出上千请求，每个都卡在超时上，20 秒只成功 8 个。
     * 串行 + 短超时反而更快，因为绝大多数站点第一个候选就命中，
     * 失败时最坏 3 个 × 3s = 9s，也可以接受。
     */
    const run = async () => {
      for (const candidate of list) {
        if (!alive) return;
        const hit = await probe(candidate);
        if (!alive) return;
        // 命中，或者已经是最后一个候选（失败）
        if (hit || candidate === list[list.length - 1]) {
          setSrc(hit ?? '');
          return;
        }
      }
      if (alive) setSrc('');
    };

    void run();

    return () => { alive = false; };
  }, [key]);

  return src;
};

/**
 * 判断一张 favicon 是不是"废图"——纯色、透明或几乎是空白。
 *
 * 有些站点把 /favicon.ico 指向一张全白/全透明的图片，图片确实
 * 加载成功了，但渲染出来就是一个空方块，比首字母还难看。
 * 这里抽样像素，白色或透明占比超过 85% 就判定为废图。
 */
export const isBlankImage = (image: HTMLImageElement): boolean => {
  try {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let blank = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      // 透明，或者接近白色，都算空白
      if (a < 24 || (r > 244 && g > 244 && b > 244)) blank++;
    }
    return blank / (size * size) > 0.85;
  } catch {
    // 跨域图片读不了像素时会抛错，此时不做判断
    return false;
  }
};

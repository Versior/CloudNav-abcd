import React from 'react';

/**
 * favicon 候选地址。顺序是这个文件里最重要的东西。
 *
 * **代理优先**，不是直连优先：
 * 1. 直连站点图标会被 Chrome 的 ORB（Opaque Response Blocking）拦掉——
 *    跨域 + 无 CORS 头 + no-referrer 的图片资源会被直接判定为
 *    ERR_BLOCKED_BY_ORB / ERR_BLOCKED_BY_RESPONSE.NotSameOrigin。
 *    实测线上 140 个图标请求里有 27 个就是这么死掉的，重试多少次都不会好。
 * 2. /api/favicon 是同源请求，不受 ORB 影响，且由 Cloudflare 边缘去抓，
 *    可达性不依赖用户本地网络。
 *
 * 实测同一批被 ORB 拦掉的域名：直连 4/12 成功，走代理 8/12 成功。
 * 全量抽测 60 个域名，代理成功 48 个。所以代理放前面，直连作为后备。
 */
export const faviconCandidates = (url: string): string[] => {
  try {
    const { origin } = new URL(url);
    return [
      `/api/favicon?url=${encodeURIComponent(origin)}`,
      `${origin}/favicon.ico`,
      `${origin}/apple-touch-icon.png`,
    ];
  } catch {
    return [];
  }
};

/** 单张图探测的超时。代理要在边缘现场抓图，冷启动实测 1–3s。 */
const PROBE_TIMEOUT = 5000;

/**
 * 全局并发闸门。
 *
 * 这是整个文件的关键。首屏有 50 张卡片、每张 3 个候选地址，
 * 如果全部同时发出去就是 150 个请求：浏览器对同域只有 6 条连接，
 * 跨域各站排队，结果是全都挤到超时，实测只成功 3/50。
 * 限制到 8 个并发后，请求排队但每个都能在超时内完成。
 */
const MAX_CONCURRENT = 8;
let inFlight = 0;
const waiting: Array<() => void> = [];

const acquire = (): Promise<void> => {
  if (inFlight < MAX_CONCURRENT) {
    inFlight += 1;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    waiting.push(() => {
      inFlight += 1;
      resolve();
    });
  });
};

const release = () => {
  inFlight -= 1;
  const next = waiting.shift();
  if (next) next();
};

const probe = async (src: string): Promise<string | null> => {
  await acquire();
  try {
    return await new Promise<string | null>(resolve => {
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
  } finally {
    release();
  }
};

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
     * 按优先级 probe，第一个成功即止，但每个候选都要过并发闸门，
     * 所以这里逐个 await：拿到结果再决定要不要试下一个。
     *
     * 为什么不是全部同时发：并发闸门只有 8 个位，一张卡占满 3 个位
     * 会挤掉其它卡片；串行能让每张卡至少推进一个候选。
     */
    const run = async () => {
      for (const candidate of list) {
        if (!alive) return;
        const hit = await probe(candidate);
        if (!alive) return;
        if (hit) {
          setSrc(hit);
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

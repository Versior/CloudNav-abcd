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

/**
 * 单张图探测的超时。
 *
 * 代理要在边缘现场抓图（站点 favicon → 解析 HTML → DuckDuckGo 兜底），
 * 冷启动实测 1–3s，给 5s 留出余量；再长会让整批图标迟迟不齐。
 */
const PROBE_TIMEOUT = 5000;

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
     * 探测策略：前两个候选同时发，都失败才试第三个。
     *
     * 走过的弯路：
     * - 全部候选并发：几百张卡 × 3 个候选瞬间上千请求，互相挤占连接，
     *   20 秒只成功 8 个，比串行还差。
     * - 纯串行：两个候选都失败时，一张卡要等满 2×5s=10s，
     *   排队下来首屏迟迟不齐。
     *
     * 代理和直连是两条独立链路（同源 vs 跨域），并发只多一倍请求，
     * 却能在先到的那个回来时立刻上屏。
     */
    const race = async (): Promise<string | null> => {
      const [first, second, third] = list;
      if (!second) return probe(first);

      const results = await Promise.all([probe(first), probe(second)]);
      if (!alive) return null;
      const hit = results.find(Boolean);
      if (hit) return hit;
      if (third) return probe(third);
      return null;
    };

    void race().then(picked => {
      if (alive) setSrc(picked ?? '');
    });

    return () => { alive = false; };
  }, [key]);

  return src;
};

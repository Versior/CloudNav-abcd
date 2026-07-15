import { LinkItem } from '../types';

export type HealthStatus = NonNullable<LinkItem['health']>['status'];

export interface HealthCheckResult {
  status: HealthStatus | 'invalid';
  statusCode?: number;
  finalUrl?: string;
  checkedAt: number;
  error?: string;
  reason?: string;
}

/** Only hard-dead links are safe for bulk cleanup. */
export const isHardBroken = (health?: LinkItem['health'] | HealthCheckResult | null) => {
  if (!health) return false;
  if (health.status === 'broken') return true;
  const code = health.statusCode;
  return code === 404 || code === 410;
};

/** Soft issues: bot wall / timeout / 5xx — do not auto-delete. */
export const isSoftIssue = (health?: LinkItem['health'] | HealthCheckResult | null) => {
  if (!health) return false;
  if (health.status === 'unknown') return true;
  const code = health.statusCode ?? -1;
  return [401, 403, 407, 429, 500, 502, 503, 504].includes(code);
};

export const isUnhealthy = (status?: string) => status === 'broken';

export const healthLabel = (status?: string, statusCode?: number) => {
  if (status === 'ok') return '正常';
  if (status === 'redirected') return '已跳转';
  if (status === 'broken') return '确定失效';
  if (status === 'unknown') {
    if (statusCode === 403 || statusCode === 401) return '探测受阻';
    if (statusCode === 429) return '限流/防爬';
    if (statusCode === 0) return '探测失败';
    if (statusCode && statusCode >= 500) return '服务器异常';
    return '待确认';
  }
  return '未检测';
};

export const healthReasonFromCode = (status?: string, statusCode?: number, reason?: string) => {
  if (reason) return reason;
  if (status === 'broken') {
    if (statusCode === 404) return '页面不存在 (404)';
    if (statusCode === 410) return '资源已永久移除';
    return '确定无法访问';
  }
  if (status === 'unknown') {
    if (statusCode === 403) return '疑似防爬拦截，浏览器通常仍可打开';
    if (statusCode === 401) return '需要登录，不一定失效';
    if (statusCode === 429) return '站点限流，稍后可重试';
    if (statusCode === 0) return '服务器探测失败，浏览器可能仍可打开';
    if (statusCode && statusCode >= 500) return `服务器临时错误 HTTP ${statusCode}`;
    return '无法确认，请手动打开验证';
  }
  if (status === 'redirected') return '站点发生了跳转';
  return '';
};

/** Manual correction after human verification — treat link as healthy. */
export const makeCorrectedOkHealth = (finalUrl?: string): NonNullable<LinkItem['health']> => ({
  status: 'ok',
  statusCode: 200,
  finalUrl,
  checkedAt: Date.now(),
});

export const needsHealthCorrection = (health?: LinkItem['health'] | null) =>
  Boolean(health && health.status && health.status !== 'ok');

export const checkLinkHealth = async (url: string): Promise<HealthCheckResult> => {
  const response = await fetch('/api/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'checkHealth', url }),
  });

  const raw = await response.text().catch(() => '');
  let data: any = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(`健康检查返回异常：${raw.slice(0, 120)}`);
  }

  if (!response.ok && !data.status) {
    throw new Error(typeof data.error === 'string' ? data.error : `健康检查失败（HTTP ${response.status}）`);
  }

  const status = (data.status || 'unknown') as HealthStatus | 'invalid';
  return {
    status: status === 'invalid' ? 'unknown' : status,
    statusCode: typeof data.statusCode === 'number' ? data.statusCode : undefined,
    finalUrl: typeof data.finalUrl === 'string' ? data.finalUrl : undefined,
    checkedAt: typeof data.checkedAt === 'number' ? data.checkedAt : Date.now(),
    error: typeof data.error === 'string' ? data.error : undefined,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
  };
};

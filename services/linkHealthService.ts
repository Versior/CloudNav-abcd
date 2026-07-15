import { LinkItem } from '../types';

export type HealthStatus = NonNullable<LinkItem['health']>['status'];

export interface HealthCheckResult {
  status: HealthStatus | 'invalid';
  statusCode?: number;
  finalUrl?: string;
  checkedAt: number;
  error?: string;
}

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
  };
};

export const isUnhealthy = (status?: string) =>
  status === 'broken' || status === 'unknown';

export const healthLabel = (status?: string) => {
  switch (status) {
    case 'ok': return '正常';
    case 'broken': return '无法访问';
    case 'redirected': return '已跳转';
    case 'unknown': return '未知/异常';
    default: return '未检测';
  }
};

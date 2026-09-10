import type { LinkItem } from '../types.ts';
import type { HealthFrequency, HealthRunSummary, HealthScheduleConfig } from '../types.ts';

export const DEFAULT_HEALTH_SCHEDULE: HealthScheduleConfig = {
  enabled: false,
  frequency: 'daily',
  scope: 'all',
  maxLinksPerRun: 100,
};

const FREQUENCY_MS: Record<HealthFrequency, number> = {
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const isHealthFrequency = (value: unknown): value is HealthFrequency => value === '6h' || value === '12h' || value === 'daily' || value === 'weekly';

export const normalizeHealthSchedule = (value: unknown): HealthScheduleConfig => {
  const candidate = value && typeof value === 'object' ? value as Partial<HealthScheduleConfig> : {};
  const frequency = isHealthFrequency(candidate.frequency) ? candidate.frequency : DEFAULT_HEALTH_SCHEDULE.frequency;
  const scope = candidate.scope === 'unchecked' || candidate.scope === 'category' ? candidate.scope : 'all';
  const maxLinksPerRun = typeof candidate.maxLinksPerRun === 'number' && Number.isFinite(candidate.maxLinksPerRun)
    ? Math.min(500, Math.max(1, Math.floor(candidate.maxLinksPerRun)))
    : DEFAULT_HEALTH_SCHEDULE.maxLinksPerRun;
  const lastRunAt = typeof candidate.lastRunAt === 'number' && Number.isFinite(candidate.lastRunAt) && candidate.lastRunAt > 0
    ? candidate.lastRunAt
    : undefined;

  const normalized: HealthScheduleConfig = {
    enabled: candidate.enabled === true,
    frequency,
    scope,
    maxLinksPerRun,
  };
  if (typeof candidate.categoryId === 'string' && candidate.categoryId) normalized.categoryId = candidate.categoryId;
  if (lastRunAt !== undefined) normalized.lastRunAt = lastRunAt;
  return normalized;
};

export const getNextHealthRun = (value: HealthScheduleConfig, now = Date.now()): number | null => {
  const config = normalizeHealthSchedule(value);
  if (!config.enabled) return null;
  return config.lastRunAt ? config.lastRunAt + FREQUENCY_MS[config.frequency] : now;
};

export const summarizeHealthRun = (links: Pick<LinkItem, 'health'>[]): HealthRunSummary => {
  const checked = links.filter(link => !!link.health?.checkedAt);
  return {
    checked: checked.length,
    ok: checked.filter(link => link.health?.status === 'ok').length,
    broken: checked.filter(link => link.health?.status === 'broken' || link.health?.statusCode === 404 || link.health?.statusCode === 410).length,
    soft: checked.filter(link => link.health?.status === 'unknown').length,
    redirected: checked.filter(link => link.health?.status === 'redirected').length,
  };
};

import type { HealthRunSummary } from '../types.ts';
import { isPrivateHostname } from '../functions/_shared/urlSafety.ts';

export interface HealthNotificationConfig {
  enabled: boolean;
  webhookUrl: string;
  onlyNewBroken: boolean;
}

export const DEFAULT_HEALTH_NOTIFICATION: HealthNotificationConfig = {
  enabled: false,
  webhookUrl: '',
  onlyNewBroken: true,
};

const safeWebhookUrl = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || isPrivateHostname(parsed.hostname)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
};

export const normalizeHealthNotification = (value: unknown): HealthNotificationConfig => {
  const candidate = value && typeof value === 'object' ? value as Partial<HealthNotificationConfig> : {};
  const webhookUrl = safeWebhookUrl(candidate.webhookUrl);
  if (candidate.enabled === true && !webhookUrl) return { ...DEFAULT_HEALTH_NOTIFICATION };
  return {
    enabled: candidate.enabled === true,
    webhookUrl,
    onlyNewBroken: candidate.onlyNewBroken !== false,
  };
};

export const getHealthNotificationEvent = (previous: HealthRunSummary | null | undefined, current: HealthRunSummary, config: HealthNotificationConfig = DEFAULT_HEALTH_NOTIFICATION) => {
  if (current.broken <= 0 && (!previous || previous.broken <= 0)) return null;
  if (!previous && current.broken > 0) return { reason: 'initial_broken' as const, brokenDelta: current.broken };
  if (previous && current.broken > previous.broken) return { reason: 'new_broken' as const, brokenDelta: current.broken - previous.broken };
  if (previous && current.broken < previous.broken) return { reason: 'recovered' as const, brokenDelta: current.broken - previous.broken };
  if (!config.onlyNewBroken && current.broken > 0) return { reason: 'broken_links_present' as const, brokenDelta: 0 };
  return null;
};

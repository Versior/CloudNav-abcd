import { DEFAULT_DASHBOARD_CONFIG } from '../types.ts';
import type { DashboardConfig, DashboardWidgetId } from '../types.ts';

export { DEFAULT_DASHBOARD_CONFIG };

const WIDGET_IDS: DashboardWidgetId[] = ['stats', 'folders', 'activity', 'tools'];

export const normalizeDashboardConfig = (value: unknown): DashboardConfig => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_DASHBOARD_CONFIG, order: [...DEFAULT_DASHBOARD_CONFIG.order], hidden: [] };
  }

  const candidate = value as Partial<DashboardConfig>;
  const requestedOrder = Array.isArray(candidate.order) ? candidate.order : [];
  const order = WIDGET_IDS.filter(id => requestedOrder.includes(id as never));
  const fullOrder = [...order, ...WIDGET_IDS.filter(id => !order.includes(id))];
  const hidden = Array.isArray(candidate.hidden)
    ? WIDGET_IDS.filter(id => candidate.hidden?.includes(id as never))
    : [];

  if (requestedOrder.length === 0 || order.length === 0) {
    return { ...DEFAULT_DASHBOARD_CONFIG, order: [...DEFAULT_DASHBOARD_CONFIG.order], hidden: [] };
  }

  return { order: fullOrder, hidden };
};

export const moveDashboardWidget = (config: DashboardConfig, widget: DashboardWidgetId, direction: -1 | 1): DashboardConfig => {
  const normalized = normalizeDashboardConfig(config);
  const index = normalized.order.indexOf(widget);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= normalized.order.length) return normalized;

  const order = [...normalized.order];
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  return { ...normalized, order };
};

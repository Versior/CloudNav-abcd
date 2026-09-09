import { DASHBOARD_CONFIG_KEY, LOCAL_STORAGE_KEY, WORKBENCH_TOOLS_KEY } from '../constants/storageKeys.ts';
import { DEFAULT_CATEGORIES, DEFAULT_DASHBOARD_CONFIG, INITIAL_LINKS } from '../types.ts';
import type { AppBootstrapSnapshot, Category, LinkItem } from '../types.ts';
import { normalizeDashboardConfig } from './dashboardConfig.ts';
import { normalizeWorkbenchTools } from './workbenchTools.ts';

export interface BootstrapLinkData {
  links: LinkItem[];
  categories: Category[];
}

export interface BootstrapRemoteData extends BootstrapLinkData {
  version?: number;
}

export interface AppBootstrapRefreshResult {
  snapshot: AppBootstrapSnapshot;
  remoteData: BootstrapRemoteData | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const normalizeLinks = (value: unknown): LinkItem[] => {
  if (!Array.isArray(value)) return INITIAL_LINKS;
  const links = value.filter((item): item is LinkItem => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.url === 'string');
  return links.length > 0 ? links : INITIAL_LINKS;
};

const normalizeCategories = (value: unknown): Category[] => {
  if (!Array.isArray(value)) return DEFAULT_CATEGORIES;
  const categories = value
    .filter((item): item is Category => isRecord(item) && typeof item.id === 'string' && typeof item.name === 'string')
    .map(category => ({ ...category, icon: typeof category.icon === 'string' && category.icon ? category.icon : 'Folder' }));
  return categories.length > 0 ? categories : DEFAULT_CATEGORIES;
};

const normalizeLinkData = (value: unknown): BootstrapLinkData => {
  const candidate = isRecord(value) ? value : {};
  return {
    links: normalizeLinks(candidate.links),
    categories: normalizeCategories(candidate.categories),
  };
};

const mergeVisitMetadata = (localLinks: LinkItem[], incomingLinks: LinkItem[]): LinkItem[] => {
  const localById = new Map(localLinks.map(link => [link.id, link]));
  return incomingLinks.map(link => {
    const local = localById.get(link.id);
    if (!local) return link;
    return {
      ...link,
      visitCount: Math.max(link.visitCount || 0, local.visitCount || 0),
      lastVisitedAt: Math.max(link.lastVisitedAt || 0, local.lastVisitedAt || 0) || undefined,
    };
  });
};

export const mergeBootstrapData = (local: BootstrapLinkData, remote: BootstrapLinkData | null): BootstrapLinkData => {
  if (!remote || remote.links.length === 0) return local;
  return {
    links: mergeVisitMetadata(local.links, remote.links),
    categories: remote.categories.length > 0 ? remote.categories : local.categories,
  };
};

export const readBootstrapSnapshot = (): AppBootstrapSnapshot => {
  const cachedData = readJson(LOCAL_STORAGE_KEY);
  const linkData = normalizeLinkData(cachedData);
  const dashboardConfig = normalizeDashboardConfig(readJson(DASHBOARD_CONFIG_KEY) || DEFAULT_DASHBOARD_CONFIG);
  const workbenchTools = normalizeWorkbenchTools(readJson(WORKBENCH_TOOLS_KEY));
  return { ...linkData, dashboardConfig, workbenchTools };
};

export const writeBootstrapSnapshot = (snapshot: AppBootstrapSnapshot): void => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: snapshot.links, categories: snapshot.categories }));
  localStorage.setItem(DASHBOARD_CONFIG_KEY, JSON.stringify(snapshot.dashboardConfig));
  localStorage.setItem(WORKBENCH_TOOLS_KEY, JSON.stringify(snapshot.workbenchTools));
};

export const fetchBootstrap = async (localSnapshot: AppBootstrapSnapshot): Promise<AppBootstrapRefreshResult> => {
  const [storageRes, dashboardRes] = await Promise.all([
    fetch('/api/storage'),
    fetch('/api/storage?getConfig=dashboard'),
  ]);

  if (storageRes.status === 401) {
    throw new Error('AUTH_REQUIRED');
  }

  const storagePayload = storageRes.ok ? await storageRes.json().catch(() => null) : null;
  const remoteData = storagePayload && Array.isArray(storagePayload.links)
    ? { ...normalizeLinkData(storagePayload), version: typeof storagePayload.version === 'number' ? storagePayload.version : undefined }
    : null;
  const mergedData = mergeBootstrapData(localSnapshot, remoteData);
  const dashboardPayload = dashboardRes.ok ? await dashboardRes.json().catch(() => null) : null;
  const dashboardConfig = dashboardRes.ok ? normalizeDashboardConfig(dashboardPayload) : localSnapshot.dashboardConfig;
  const snapshot = { ...mergedData, dashboardConfig, workbenchTools: localSnapshot.workbenchTools };

  if (remoteData || dashboardRes.ok) writeBootstrapSnapshot(snapshot);
  return { snapshot, remoteData };
};

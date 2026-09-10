export interface StoredAppData {
  links: unknown[];
  categories: unknown[];
  version: number;
  workspace?: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const normalizeVersion = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
);

export const normalizeStoredData = (value: unknown): StoredAppData => {
  const record = asRecord(value);
  const normalized: StoredAppData = {
    links: Array.isArray(record.links) ? record.links : [],
    categories: Array.isArray(record.categories) ? record.categories : [],
    version: normalizeVersion(record.version),
  };
  if (record.workspace && typeof record.workspace === 'object') normalized.workspace = record.workspace as Record<string, unknown>;
  return normalized;
};

export const buildStoredData = (value: unknown, version: number): StoredAppData => {
  const record = normalizeStoredData(value);
  const normalized: StoredAppData = {
    links: record.links,
    categories: record.categories,
    version: normalizeVersion(version),
  };
  if (record.workspace) normalized.workspace = record.workspace;
  return normalized;
};

export const isVersionConflict = (baseVersion: unknown, currentVersion: number) => (
  typeof baseVersion === 'number' && baseVersion !== currentVersion
);

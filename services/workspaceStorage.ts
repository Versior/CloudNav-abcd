export const WORKSPACE_DATA_CHANGED_EVENT = 'cloudnav-workspace-data-changed';

export const readWorkspaceList = <T>(key: string, normalize: (value: unknown) => T[]): T[] => {
  try {
    const raw = localStorage.getItem(key);
    return normalize(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

export const writeWorkspaceList = <T>(key: string, value: T[], normalize: (value: unknown) => T[]) => {
  const normalized = normalize(value);
  localStorage.setItem(key, JSON.stringify(normalized));
  window.dispatchEvent(new Event(WORKSPACE_DATA_CHANGED_EVENT));
  return normalized;
};

export const notifyWorkspaceDataChanged = () => {
  window.dispatchEvent(new Event(WORKSPACE_DATA_CHANGED_EVENT));
};

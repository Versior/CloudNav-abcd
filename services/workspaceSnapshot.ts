import { GITHUB_WATCH_KEY, INSPIRATIONS_KEY, READ_LATER_KEY, READING_DOCUMENTS_KEY, RSS_STATE_KEY, WORKBENCH_TOOLS_KEY } from '../constants/storageKeys.ts';
import type { WorkspaceSyncData } from '../types.ts';
import { normalizeGithubWatch } from './githubService.ts';
import { normalizeInspirations } from './inspirationService.ts';
import { normalizeReadLater } from './readLaterService.ts';
import { normalizeRssState, readRssState } from './rssService.ts';
import { normalizeWorkbenchTools } from './workbenchTools.ts';
import { normalizeReadingDocuments } from './readingWorkspace.ts';
import { WORKSPACE_DATA_CHANGED_EVENT } from './workspaceStorage.ts';

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const readWorkspaceSnapshot = (): WorkspaceSyncData => ({
  rssState: readRssState(),
  inspirations: normalizeInspirations(readJson(INSPIRATIONS_KEY)),
  readLater: normalizeReadLater(readJson(READ_LATER_KEY)),
  githubWatch: normalizeGithubWatch(readJson(GITHUB_WATCH_KEY)),
  readingDocuments: normalizeReadingDocuments(readJson(READING_DOCUMENTS_KEY)),
  workbenchTools: normalizeWorkbenchTools(readJson(WORKBENCH_TOOLS_KEY)),
});

export const normalizeWorkspaceSnapshot = (value: unknown): WorkspaceSyncData => {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    rssState: record.rssState ? normalizeRssState(record.rssState) : undefined,
    inspirations: record.inspirations ? normalizeInspirations(record.inspirations) : undefined,
    readLater: record.readLater ? normalizeReadLater(record.readLater) : undefined,
    githubWatch: record.githubWatch ? normalizeGithubWatch(record.githubWatch) : undefined,
    readingDocuments: record.readingDocuments ? normalizeReadingDocuments(record.readingDocuments) : undefined,
    workbenchTools: record.workbenchTools ? normalizeWorkbenchTools(record.workbenchTools) : undefined,
  };
};

export const mergeWorkspaceSnapshot = (local: WorkspaceSyncData, remote?: unknown): WorkspaceSyncData => {
  const normalized = normalizeWorkspaceSnapshot(remote);
  return {
    rssState: normalized.rssState || local.rssState,
    inspirations: normalized.inspirations || local.inspirations,
    readLater: normalized.readLater || local.readLater,
    githubWatch: normalized.githubWatch || local.githubWatch,
    readingDocuments: normalized.readingDocuments || local.readingDocuments,
    workbenchTools: normalized.workbenchTools || local.workbenchTools,
  };
};

export const writeWorkspaceSnapshot = (value: WorkspaceSyncData, notify = true) => {
  const next = normalizeWorkspaceSnapshot(value);
  const writes: Array<[string, unknown]> = [
    [RSS_STATE_KEY, next.rssState],
    [INSPIRATIONS_KEY, next.inspirations],
    [READ_LATER_KEY, next.readLater],
    [GITHUB_WATCH_KEY, next.githubWatch],
    [READING_DOCUMENTS_KEY, next.readingDocuments],
    [WORKBENCH_TOOLS_KEY, next.workbenchTools],
  ];
  for (const [key, data] of writes) {
    if (data !== undefined) localStorage.setItem(key, JSON.stringify(data));
  }
  if (notify) window.dispatchEvent(new Event(WORKSPACE_DATA_CHANGED_EVENT));
  return next;
};

import type { AIConfig, Category, GithubWatchItem, Inspiration, LinkItem, ReadLaterItem, ReadingDocument, RssState, SearchConfig } from '../types.ts';
import { normalizeWorkbenchTools, type WorkbenchToolsState } from './workbenchTools.ts';
import { normalizeInspirations } from './inspirationService.ts';
import { normalizeReadLater } from './readLaterService.ts';
import { normalizeGithubWatch } from './githubService.ts';
import { normalizeReadingDocuments } from './readingWorkspace.ts';
import { normalizeRssState } from './rssService.ts';

export interface BackupPayload {
  links: LinkItem[];
  categories: Category[];
  searchConfig?: SearchConfig;
  aiConfig?: AIConfig;
  workbenchTools?: WorkbenchToolsState;
  inspirations?: Inspiration[];
  readLater?: ReadLaterItem[];
  githubWatch?: GithubWatchItem[];
  readingDocuments?: ReadingDocument[];
  rssState?: RssState;
}

export interface BackupEnvelope extends BackupPayload {
  schemaVersion: 2;
  metadata: {
    createdAt: number;
    version: number;
    linkCount: number;
    categoryCount: number;
  };
}

export const sanitizeBackupData = (data: BackupPayload): BackupPayload => ({
  ...data,
  links: data.links.map(link => ({
    ...link,
    credentials: link.credentials?.map(credential => ({ ...credential })),
  })),
  categories: data.categories.map(category => ({ ...category })),
  searchConfig: data.searchConfig ? { ...data.searchConfig, externalSources: data.searchConfig.externalSources.map(source => ({ ...source })) } : undefined,
  aiConfig: data.aiConfig ? { ...data.aiConfig, apiKey: '' } : undefined,
  workbenchTools: data.workbenchTools ? normalizeWorkbenchTools(data.workbenchTools) : undefined,
  inspirations: data.inspirations ? normalizeInspirations(data.inspirations) : undefined,
  readLater: data.readLater ? normalizeReadLater(data.readLater) : undefined,
  githubWatch: data.githubWatch ? normalizeGithubWatch(data.githubWatch) : undefined,
  readingDocuments: data.readingDocuments ? normalizeReadingDocuments(data.readingDocuments) : undefined,
  rssState: data.rssState ? normalizeRssState(data.rssState) : undefined,
});

export const createBackupEnvelope = (data: BackupPayload, version = 0, createdAt = Date.now()): BackupEnvelope => {
  const sanitized = sanitizeBackupData(data);
  return {
    ...sanitized,
    schemaVersion: 2,
    metadata: { createdAt, version, linkCount: sanitized.links.length, categoryCount: sanitized.categories.length },
  };
};

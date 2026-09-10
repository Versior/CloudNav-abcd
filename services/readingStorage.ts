import { READING_DOCUMENTS_KEY, READING_VIEWS_KEY } from '../constants/storageKeys.ts';
import type { ReadingDocument, ReadingView } from '../types.ts';
import { normalizeReadingDocuments } from './readingWorkspace.ts';
import { WORKSPACE_DATA_CHANGED_EVENT } from './workspaceStorage.ts';

export const readReadingDocuments = (): ReadingDocument[] => {
  try {
    const raw = localStorage.getItem(READING_DOCUMENTS_KEY);
    return normalizeReadingDocuments(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

export const writeReadingDocuments = (documents: ReadingDocument[]) => {
  const normalized = normalizeReadingDocuments(documents);
  localStorage.setItem(READING_DOCUMENTS_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new Event(WORKSPACE_DATA_CHANGED_EVENT));
  return normalized;
};

export const readReadingViews = (): ReadingView[] => {
  try {
    const raw = localStorage.getItem(READING_VIEWS_KEY);
    const source = raw ? JSON.parse(raw) : [];
    return Array.isArray(source) ? source.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.query === 'string') : [];
  } catch {
    return [];
  }
};

export const writeReadingViews = (views: ReadingView[]) => {
  localStorage.setItem(READING_VIEWS_KEY, JSON.stringify(views));
  window.dispatchEvent(new Event(WORKSPACE_DATA_CHANGED_EVENT));
  return views;
};

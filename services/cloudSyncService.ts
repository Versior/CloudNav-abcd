import { LinkItem, Category } from '../types';
import { PENDING_SYNC_KEY, LOCAL_STORAGE_KEY } from '../constants/storageKeys';

export interface SyncState {
  syncStatus: 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';
  baseVersion: number;
  pendingLinks: LinkItem[] | null;
  pendingCategories: Category[] | null;
}

export interface SyncCallbacks {
  onStatusChange: (status: SyncState['syncStatus']) => void;
  onVersionChange: (version: number) => void;
  onMergeData: (links: LinkItem[], categories: Category[]) => void;
  onAuthExpired: () => void;
  onConflictOvershoot: (pending: { links: LinkItem[]; categories: Category[] }) => void;
  getBaseVersion: () => number;
}

export const syncToCloud = async (
  newLinks: LinkItem[],
  newCategories: Category[],
  token: string,
  retry: number,
  callbacks: SyncCallbacks,
  mergeById: (cloud: any[], local: any[]) => any[]
): Promise<boolean> => {
  callbacks.onStatusChange('saving');
  try {
    const response = await fetch('/api/storage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-password': token
      },
      body: JSON.stringify({ links: newLinks, categories: newCategories, baseVersion: callbacks.getBaseVersion() })
    });

    if (response.status === 401) {
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('过期')) {
          alert('您的密码已过期，请重新登录');
        }
      } catch {}

      callbacks.onAuthExpired();
      callbacks.onStatusChange('error');
      return false;
    }

    if (response.status === 409) {
      if (retry >= 2) {
        callbacks.onConflictOvershoot({ links: newLinks, categories: newCategories });
        callbacks.onStatusChange('conflict');
        return false;
      }
      let cloud: any = null;
      try {
        const conflict = await response.json();
        cloud = conflict && conflict.data;
      } catch {}
      if (cloud && Array.isArray(cloud.links)) {
        const mergedLinks = mergeById(cloud.links, newLinks);
        const mergedCategories = mergeById(cloud.categories || [], newCategories);
        callbacks.onVersionChange(typeof cloud.version === 'number' ? cloud.version : callbacks.getBaseVersion());
        callbacks.onMergeData(mergedLinks, mergedCategories);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: mergedLinks, categories: mergedCategories, version: callbacks.getBaseVersion() }));
        return await syncToCloud(mergedLinks, mergedCategories, token, retry + 1, callbacks, mergeById);
      }
      callbacks.onStatusChange('conflict');
      return false;
    }

    if (!response.ok) throw new Error('Network response was not ok');

    const result = await response.json().catch(() => ({}));
    if (typeof result.version === 'number') callbacks.onVersionChange(result.version);
    localStorage.removeItem(PENDING_SYNC_KEY);
    callbacks.onStatusChange('saved');
    setTimeout(() => callbacks.onStatusChange('idle'), 2000);
    return true;
  } catch (error) {
    localStorage.setItem(PENDING_SYNC_KEY, '1');
    callbacks.onConflictOvershoot({ links: newLinks, categories: newCategories });
    callbacks.onStatusChange('error');
    return false;
  }
};

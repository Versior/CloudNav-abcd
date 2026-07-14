import { useState, useRef, useCallback } from 'react';
import { LinkItem, Category } from '../types';
import { PENDING_SYNC_KEY, LOCAL_STORAGE_KEY } from '../constants/storageKeys';

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline' | 'conflict';

interface SyncContext {
  authToken: boolean;
  onDataUpdate: (links: LinkItem[], categories: Category[]) => void;
  onAuthExpired: () => void;
}

export const useCloudSync = (ctx: SyncContext) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const dataVersionRef = useRef<number>(0);
  const pendingSyncRef = useRef<{ links: LinkItem[]; categories: Category[] } | null>(null);

  const syncToCloud = useCallback(async (
    newLinks: LinkItem[],
    newCategories: Category[],
    retry: number = 0
  ): Promise<boolean> => {
    setSyncStatus('saving');
    try {
      const response = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ links: newLinks, categories: newCategories, baseVersion: dataVersionRef.current })
      });

      if (response.status === 401) {
        ctx.onAuthExpired();
        setSyncStatus('error');
        return false;
      }

      if (response.status === 409) {
        if (retry >= 2) {
          pendingSyncRef.current = { links: newLinks, categories: newCategories };
          localStorage.setItem(PENDING_SYNC_KEY, '1');
          setSyncStatus('conflict');
          return false;
        }
        let cloud: any = null;
        try {
          const conflict = await response.json();
          cloud = conflict && conflict.data;
        } catch {}
        if (cloud && Array.isArray(cloud.links)) {
          const { mergeById } = await import('../services/localStorageService');
          const mergedLinks = mergeById(cloud.links, newLinks);
          const mergedCategories = mergeById(cloud.categories || [], newCategories);
          dataVersionRef.current = typeof cloud.version === 'number' ? cloud.version : dataVersionRef.current;
          ctx.onDataUpdate(mergedLinks, mergedCategories);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ links: mergedLinks, categories: mergedCategories, version: dataVersionRef.current }));
          return await syncToCloud(mergedLinks, mergedCategories, retry + 1);
        }
        setSyncStatus('conflict');
        return false;
      }

      if (!response.ok) throw new Error('Network response was not ok');

      const result = await response.json().catch(() => ({}));
      if (typeof result.version === 'number') dataVersionRef.current = result.version;
      pendingSyncRef.current = null;
      localStorage.removeItem(PENDING_SYNC_KEY);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
      return true;
    } catch (error) {
      pendingSyncRef.current = { links: newLinks, categories: newCategories };
      localStorage.setItem(PENDING_SYNC_KEY, '1');
      setSyncStatus('error');
      return false;
    }
  }, [ctx]);

  const retrySync = useCallback(() => {
    if (pendingSyncRef.current && ctx.authToken) {
      syncToCloud(pendingSyncRef.current.links, pendingSyncRef.current.categories);
    }
  }, [syncToCloud, ctx.authToken]);

  return {
    syncStatus,
    setSyncStatus,
    dataVersionRef,
    pendingSyncRef,
    syncToCloud,
    retrySync,
  };
};

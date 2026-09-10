import { PENDING_SYNC_KEY } from '../constants/storageKeys.ts';
import { coalescePendingMutations, type PendingMutation } from './offlineQueue.ts';

const DB_NAME = 'cloudnav-offline';
const STORE_NAME = 'mutations';

const canUseIndexedDb = () => typeof indexedDB !== 'undefined';

const readFallback = (): PendingMutation[] => {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeFallback = (items: PendingMutation[]) => {
  try { localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(items)); } catch {}
};

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
});

const readIndexed = async (): Promise<PendingMutation[]> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => { db.close(); resolve(Array.isArray(request.result) ? request.result : []); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
};

const writeIndexed = async (items: PendingMutation[]) => {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    items.forEach(item => store.put(item));
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
};

export const readPendingMutations = async (): Promise<PendingMutation[]> => {
  if (!canUseIndexedDb()) return readFallback();
  try { return await readIndexed(); } catch { return readFallback(); }
};

export const enqueuePendingMutation = async (mutation: PendingMutation) => {
  const next = coalescePendingMutations(await readPendingMutations(), mutation);
  if (canUseIndexedDb()) {
    try { await writeIndexed(next); return next; } catch {}
  }
  writeFallback(next);
  return next;
};

export const replacePendingMutations = async (items: PendingMutation[]) => {
  if (canUseIndexedDb()) {
    try { await writeIndexed(items); return; } catch {}
  }
  writeFallback(items);
};

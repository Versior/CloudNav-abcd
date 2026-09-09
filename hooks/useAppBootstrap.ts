import { useCallback, useState } from 'react';
import type { AppBootstrapSnapshot, AppBootstrapStatus } from '../types.ts';
import { fetchBootstrap, readBootstrapSnapshot, type AppBootstrapRefreshResult } from '../services/appBootstrap.ts';

export interface UseAppBootstrapOptions {
  autoStart?: boolean;
}

export const useAppBootstrap = (_options: UseAppBootstrapOptions = {}) => {
  const [snapshot, setSnapshot] = useState<AppBootstrapSnapshot>(() => readBootstrapSnapshot());
  const [status, setStatus] = useState<AppBootstrapStatus>('local');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<AppBootstrapRefreshResult> => {
    setStatus('hydrating');
    setError(null);
    try {
      const result = await fetchBootstrap(snapshot);
      setSnapshot(result.snapshot);
      setStatus('ready');
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '启动数据加载失败';
      setError(message);
      setStatus('error');
      throw reason;
    }
  }, [snapshot]);

  return { snapshot, status, error, refresh };
};

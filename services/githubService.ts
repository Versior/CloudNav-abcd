import type { GithubWatchItem } from '../types.ts';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export const parseGithubRepositoryUrl = (value: string): { owner: string; repo: string } | null => {
  try {
    const raw = value.startsWith('http') ? value : `https://${value}`;
    const url = new URL(raw);
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0]) || !/^[\w.-]+$/.test(parts[1])) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch { return null; }
};

export const normalizeGithubWatchItem = (value: unknown, now = Date.now()): GithubWatchItem => {
  const item = (value && typeof value === 'object' ? value : {}) as Partial<GithubWatchItem>;
  const owner = clean(item.owner, 80);
  const repo = clean(item.repo, 120);
  const url = `https://github.com/${owner}/${repo}`;
  return {
    id: clean(item.id, 160) || `github-${owner}-${repo}`,
    owner, repo, url,
    description: clean(item.description, 280) || undefined,
    stars: Number.isFinite(item.stars) ? Math.max(0, Number(item.stars)) : undefined,
    language: clean(item.language, 60) || undefined,
    lastRelease: clean(item.lastRelease, 180) || undefined,
    readme: clean(item.readme, 3000) || undefined,
    lastFetchedAt: now,
    processedAt: Number.isFinite(item.processedAt) ? Number(item.processedAt) : undefined,
    error: clean(item.error, 240) || undefined,
  };
};

export const normalizeGithubWatch = (value: unknown): GithubWatchItem[] => Array.isArray(value)
  ? value.map(item => normalizeGithubWatchItem(item, Number((item as GithubWatchItem)?.lastFetchedAt) || Date.now())).filter(item => item.owner && item.repo).slice(0, 200)
  : [];

export interface GithubRepositorySnapshot {
  owner: string;
  repo: string;
  description?: string;
  stars?: number;
  language?: string;
  pushedAt?: string;
  url: string;
}

export const fetchGithubRepository = async (owner: string, repo: string): Promise<GithubRepositorySnapshot> => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`/api/github?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, { signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : 'GitHub 刷新失败');
  if (!payload?.repository || typeof payload.repository !== 'object') throw new Error('GitHub 返回数据无效');
  return payload.repository as GithubRepositorySnapshot;
};

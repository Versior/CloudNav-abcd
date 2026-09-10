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

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
};

const readGithubError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => ({})) as { error?: unknown };
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (response.status === 403) return 'GitHub API 暂时限流，请稍后重试';
  if (response.status === 404) return 'GitHub 仓库不存在或无权访问';
  return fallback;
};

const toGithubSnapshot = (owner: string, repo: string, value: unknown): GithubRepositorySnapshot => {
  if (!value || typeof value !== 'object') throw new Error('GitHub 返回数据无效');
  const payload = value as Record<string, unknown>;
  return {
    owner,
    repo,
    description: typeof payload.description === 'string' ? payload.description : '',
    stars: typeof payload.stargazers_count === 'number' ? payload.stargazers_count : typeof payload.stars === 'number' ? payload.stars : undefined,
    language: typeof payload.language === 'string' ? payload.language : '',
    pushedAt: typeof payload.pushed_at === 'string' ? payload.pushed_at : typeof payload.pushedAt === 'string' ? payload.pushedAt : '',
    url: typeof payload.html_url === 'string' ? payload.html_url : typeof payload.url === 'string' ? payload.url : `https://github.com/${owner}/${repo}`,
  };
};

export const fetchGithubRepository = async (owner: string, repo: string): Promise<GithubRepositorySnapshot> => {
  const proxyUrl = `/api/github?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
  let proxyError: unknown;
  try {
    const response = await fetchWithTimeout(proxyUrl);
    const payload = await response.json().catch(() => ({})) as { repository?: unknown; error?: unknown };
    if (!response.ok) throw new Error(await readGithubError(new Response(JSON.stringify(payload), { status: response.status }), 'GitHub 刷新失败'));
    return toGithubSnapshot(owner, repo, payload.repository);
  } catch (error) {
    proxyError = error;
  }

  // Pages Functions can be temporarily unavailable or absent on older deployments.
  // GitHub's public API supports browser CORS, so keep metadata refresh usable while
  // the proxy recovers instead of turning a transient 502 into a permanent error.
  try {
    const response = await fetchWithTimeout(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(await readGithubError(response, 'GitHub 刷新失败'));
    return toGithubSnapshot(owner, repo, await response.json());
  } catch (error) {
    if (error instanceof Error && error.message && error.message !== 'fetch failed') throw error;
    if (proxyError instanceof Error && proxyError.message && proxyError.message !== 'fetch failed') throw proxyError;
    throw new Error('GitHub 暂时无法获取信息，请稍后重试');
  }
};

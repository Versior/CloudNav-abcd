import { jsonResponse, optionsResponse } from '../_shared/auth.ts';

const isSegment = (value: string) => /^[A-Za-z0-9_.-]{1,120}$/.test(value);

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request }) => {
  const params = new URL(context.request.url).searchParams;
  const owner = params.get('owner')?.trim() || '';
  const repo = params.get('repo')?.trim().replace(/\.git$/, '') || '';
  if (!isSegment(owner) || !isSegment(repo)) {
    return jsonResponse({ error: 'GitHub repository is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CloudNav GitHub Radar/1.0',
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = response.status === 403 ? 'GitHub API 暂时限流，请稍后重试' : `GitHub 返回 HTTP ${response.status}`;
      return jsonResponse({ error: message }, { status: response.status === 404 ? 404 : 502 });
    }
    return jsonResponse({
      repository: {
        owner,
        repo,
        description: typeof payload.description === 'string' ? payload.description : '',
        stars: typeof payload.stargazers_count === 'number' ? payload.stargazers_count : undefined,
        language: typeof payload.language === 'string' ? payload.language : '',
        pushedAt: typeof payload.pushed_at === 'string' ? payload.pushed_at : '',
        url: typeof payload.html_url === 'string' ? payload.html_url : `https://github.com/${owner}/${repo}`,
      },
      fetchedAt: Date.now(),
    }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'GitHub 请求失败' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
};

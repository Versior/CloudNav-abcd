import { clearSessionCookie, createExtensionToken, createSessionCookie, isAuthenticated, jsonResponse, optionsResponse, verifyPassword } from '../_shared/auth';
import { getLoginRateLimitDecision, getLoginRateLimitKey } from '../../services/authSecurity';

interface Env {
  PASSWORD: string;
  SESSION_SECRET?: string;
  CLOUDNAV_KV?: KVNamespace;
}

export const onRequestOptions = async () => optionsResponse();

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const authenticated = await isAuthenticated(context.request, context.env);
  return jsonResponse({
    authenticated,
    requiresAuth: !!context.env.PASSWORD,
    extensionToken: authenticated ? await createExtensionToken(context.env) : '',
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  try {
    const body = await request.json() as { password?: string; action?: string };

    if (body.action === 'logout') {
      return jsonResponse({ success: true }, {
        headers: { 'Set-Cookie': clearSessionCookie() },
      });
    }

    const rateKey = getLoginRateLimitKey(request);
    const now = Date.now();
    const rateStateValue = env.CLOUDNAV_KV ? await env.CLOUDNAV_KV.get(rateKey) : null;
    let rateState: { count?: number; firstAttemptAt?: number } | null = null;
    if (rateStateValue) {
      try { rateState = JSON.parse(rateStateValue) as { count?: number; firstAttemptAt?: number }; } catch { rateState = null; }
    }
    const failedCount = typeof rateState?.count === 'number' ? rateState.count : 0;
    const elapsedMs = rateState?.firstAttemptAt ? now - rateState.firstAttemptAt : 0;
    const rateLimit = getLoginRateLimitDecision(failedCount, elapsedMs);
    if (!rateLimit.allowed) {
      return jsonResponse({ error: 'Too many login attempts', retryAfterMs: rateLimit.retryAfterMs }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.retryAfterMs || 0) / 1000)) } });
    }

    if (!verifyPassword(body.password || '', env)) {
      if (env.CLOUDNAV_KV) {
        const firstAttemptAt = rateState?.firstAttemptAt && elapsedMs < 5 * 60 * 1000 ? rateState.firstAttemptAt : now;
        await env.CLOUDNAV_KV.put(rateKey, JSON.stringify({ count: failedCount + 1, firstAttemptAt }), { expirationTtl: 5 * 60 });
      }
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    if (env.CLOUDNAV_KV) await env.CLOUDNAV_KV.delete(rateKey);

    return jsonResponse({ success: true, extensionToken: await createExtensionToken(env) }, {
      headers: { 'Set-Cookie': await createSessionCookie(env) },
    });
  } catch {
    return jsonResponse({ error: 'Invalid request' }, { status: 400 });
  }
};

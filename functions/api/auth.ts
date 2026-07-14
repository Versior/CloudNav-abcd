import { clearSessionCookie, createExtensionToken, createSessionCookie, isAuthenticated, jsonResponse, optionsResponse, verifyPassword } from '../_shared/auth';

interface Env {
  PASSWORD: string;
  SESSION_SECRET?: string;
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

    if (!verifyPassword(body.password || '', env)) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
    }

    return jsonResponse({ success: true, extensionToken: await createExtensionToken(env) }, {
      headers: { 'Set-Cookie': await createSessionCookie(env) },
    });
  } catch {
    return jsonResponse({ error: 'Invalid request' }, { status: 400 });
  }
};

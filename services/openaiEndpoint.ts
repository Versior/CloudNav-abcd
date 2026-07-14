export const normalizeOpenAIEndpoint = (baseUrl?: string) => {
  const raw = (baseUrl || '').trim();
  if (!raw) throw new Error('OpenAI 兼容 API 地址不能为空，例如 https://api.openai.com/v1');

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('OpenAI 兼容 API 地址格式无效，必须以 http:// 或 https:// 开头');
  }

  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('OpenAI 兼容 API 地址只支持 http:// 或 https://');
  }

  const host = url.hostname.toLowerCase();
  const cleanPath = url.pathname.replace(/\/+$/, '');

  if (host === 'chat.openai.com' || host === 'chatgpt.com') {
    throw new Error('ChatGPT 网页地址不能作为 API 地址。OpenAI 官方请填写 https://api.openai.com/v1');
  }
  if (host === 'claude.ai') {
    throw new Error('Claude 网页地址不能作为 OpenAI Compatible API 地址。请填写兼容服务商的 /v1 接口地址');
  }
  if (host === 'www.deepseek.com') {
    url.hostname = 'api.deepseek.com';
    url.pathname = '/chat/completions';
    return url.toString();
  }
  if (host === 'deepseek.com' || host === 'api.deepseek.com') {
    url.hostname = 'api.deepseek.com';
    url.pathname = cleanPath.endsWith('/chat/completions') ? cleanPath : '/chat/completions';
    return url.toString();
  }
  if (host === 'openrouter.ai' || host === 'www.openrouter.ai') {
    url.hostname = 'openrouter.ai';
    url.pathname = cleanPath.endsWith('/chat/completions') ? cleanPath : '/api/v1/chat/completions';
    return url.toString();
  }
  if (host === 'api.openai.com') {
    if (cleanPath.endsWith('/chat/completions')) return url.toString();
    if (cleanPath !== '/v1') throw new Error('OpenAI 官方 API 地址应填写 https://api.openai.com/v1');
    url.pathname = '/v1/chat/completions';
    return url.toString();
  }
  if (host.includes('siliconflow.cn')) {
    url.pathname = cleanPath.endsWith('/chat/completions') ? cleanPath : '/v1/chat/completions';
    return url.toString();
  }
  if (host.includes('moonshot.cn')) {
    url.pathname = cleanPath.endsWith('/chat/completions') ? cleanPath : '/v1/chat/completions';
    return url.toString();
  }
  if (host.includes('bigmodel.cn')) {
    url.pathname = cleanPath.endsWith('/chat/completions') ? cleanPath : '/api/paas/v4/chat/completions';
    return url.toString();
  }

  if (cleanPath.endsWith('/chat/completions')) return url.toString();
  if (cleanPath.endsWith('/v1') || cleanPath.endsWith('/api/v1')) {
    url.pathname = `${cleanPath}/chat/completions`.replace(/\/+/g, '/');
    return url.toString();
  }

  url.pathname = `${cleanPath || ''}/chat/completions`.replace(/\/+/g, '/');
  return url.toString();
};

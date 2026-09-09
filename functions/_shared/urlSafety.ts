const isRedirect = (status: number) => status >= 300 && status < 400;

const parseIpv4 = (hostname: string) => {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.some(part => part > 255)) return null;
  return numbers;
};

const isPrivateIpv4 = ([a, b, c]: number[]) => (
  a === 0 ||
  a === 10 ||
  a === 127 ||
  (a === 100 && b >= 64 && b <= 127) ||
  (a === 169 && b === 254) ||
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 192 && b === 0 && c === 0) ||
  (a === 198 && (b === 18 || b === 19)) ||
  a >= 224
);

export const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (
    !normalized ||
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.includes(':')
  ) return true;

  const ipv4 = parseIpv4(normalized);
  return ipv4 ? isPrivateIpv4(ipv4) : false;
};

export const assertSafeExternalUrl = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed');
  }
  if (parsed.username || parsed.password || isPrivateHostname(parsed.hostname)) {
    throw new Error('Private or credential-bearing URLs are not allowed');
  }
  return parsed;
};

export const resolveRedirectTarget = (baseUrl: string, location: string) => {
  let parsed: URL;
  try {
    parsed = new URL(location, baseUrl);
  } catch {
    throw new Error('Invalid redirect location');
  }

  return assertSafeExternalUrl(parsed.toString());
};

export const fetchWithSafeRedirects = async (
  input: string,
  init: RequestInit = {},
  maxRedirects = 5,
) => {
  let currentUrl = assertSafeExternalUrl(input).toString();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (!isRedirect(response.status)) return response;

    const location = response.headers.get('Location');
    if (!location) return response;
    if (redirectCount === maxRedirects) throw new Error('Too many redirects');
    currentUrl = resolveRedirectTarget(currentUrl, location).toString();
  }

  throw new Error('Too many redirects');
};

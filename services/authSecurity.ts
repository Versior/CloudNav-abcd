export interface LoginRateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export const getLoginRateLimitDecision = (failedCount: number, elapsedMs: number, maxAttempts = 5, windowMs = 5 * 60 * 1000): LoginRateLimitDecision => {
  if (elapsedMs >= windowMs) return { allowed: true, remaining: maxAttempts };
  const remaining = Math.max(0, maxAttempts - Math.max(0, failedCount));
  return remaining > 0 ? { allowed: true, remaining: remaining - 1 } : { allowed: false, remaining: 0, retryAfterMs: windowMs - Math.max(0, elapsedMs) };
};

export const getLoginRateLimitKey = (request: Request) => {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
  return `auth_rate:${encodeURIComponent(ip)}`;
};

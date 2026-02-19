import rateLimitLib from 'express-rate-limit';
import slowDownLib from 'express-slow-down';

export const rateLimiter = rateLimitLib({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' },
    timestamp: Date.now(),
  },
});

export const strictRateLimiter = rateLimitLib({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many attempts, please try again later' },
    timestamp: Date.now(),
  },
});

export const slowDownMiddleware = slowDownLib({
  windowMs: 60 * 1000,
  delayAfter: 50,
  delayMs: 100,
  maxDelayMs: 2000,
});

export function generateCsrfToken(): string {
  return Buffer.from(crypto.randomUUID() + Date.now().toString(36)).toString('base64url');
}

export function validateCsrfToken(token: string, secret: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [uuid, timestamp] = decoded.split('.');
    const age = Date.now() - parseInt(timestamp || '0', 36);
    if (age > 60 * 60 * 1000) return false;
    const expected = Buffer.from(uuid + secret).toString('base64url');
    return token === expected;
  } catch {
    return false;
  }
}

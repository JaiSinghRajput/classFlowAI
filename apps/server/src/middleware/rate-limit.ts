import type { Request, Response, NextFunction } from 'express';
import { logger } from '@classflowai/utils';
import type { ApiResponse } from '@classflowai/types';
import { getConfig } from '../config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  max?: number;
  windowMs?: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const store = new Map<string, RateLimitEntry>();

/** Interval handle for periodic cleanup of expired entries. */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup(windowMs: number): void {
  if (cleanupInterval !== null) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs);

  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Create a rate-limiting middleware using an in-memory fixed-window counter.
 *
 * Defaults are read from the environment config (`RATE_LIMIT_MAX`,
 * `RATE_LIMIT_WINDOW_MS`) but can be overridden per-route.
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const config = getConfig();
  const max = options.max ?? config.RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? config.RATE_LIMIT_WINDOW_MS;

  startCleanup(windowMs);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now >= entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (entry.count > max) {
      logger.warn('Rate limit exceeded', { ip: key, count: entry.count, max });

      res.setHeader('Retry-After', resetSeconds);

      const response: ApiResponse<null> = {
        success: false,
        data: null,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Try again in ${resetSeconds} seconds.`,
        },
        timestamp: Date.now(),
      };

      res.status(429).json(response);
      return;
    }

    next();
  };
}

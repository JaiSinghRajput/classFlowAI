import type { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Middleware that guards against long-running requests.
 *
 * If the response has not been sent within {@link timeoutMs} milliseconds,
 * the request is aborted with a `504 Gateway Timeout` error.
 *
 * The timer is automatically cleared when the response finishes or the
 * connection closes.
 */
export function timeoutGuard(timeoutMs: number = DEFAULT_TIMEOUT_MS) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        next(new AppError('Request timeout', 504, 'REQUEST_TIMEOUT'));
      }
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    next();
  };
}

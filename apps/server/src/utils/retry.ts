import { logger } from '@classflowai/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  backoffMultiplier: 2,
};

// ---------------------------------------------------------------------------
// withRetry
// ---------------------------------------------------------------------------

/**
 * Execute an async function with automatic retries on failure.
 *
 * Uses exponential backoff with jitter to prevent thundering-herd issues
 * when multiple callers retry simultaneously.
 *
 * @param fn     The async operation to attempt.
 * @param config Retry behaviour overrides.
 * @returns      The result of the first successful invocation.
 * @throws       The error from the final failed attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const opts: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error = new Error('Retry failed');

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < opts.maxRetries) {
        const baseDelay = Math.min(
          opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelayMs,
        );
        const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5);

        logger.warn(`Retry attempt ${attempt + 1}/${opts.maxRetries}`, {
          error: lastError.message,
          delayMs: Math.round(jitteredDelay),
        });

        await sleep(jitteredDelay);
      }
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simple in-memory cache with TTL support
 */
export class Cache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();
  private defaultTtl: number;

  constructor(defaultTtlMs: number = 60_000) {
    this.defaultTtl = defaultTtlMs;
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 300_000);
  }

  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTtl);
    this.store.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Memoization decorator factory
 */
export function memoize<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  ttlMs: number = 60_000,
): T {
  const cache = new Map<string, { result: ReturnType<T>; expiresAt: number }>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const entry = cache.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      return entry.result;
    }

    const result = fn(...args);
    cache.set(key, { result, expiresAt: Date.now() + ttlMs });
    return result;
  }) as T;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  limitMs: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limitMs) {
      lastRun = now;
      fn(...args);
    }
  };
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

/**
 * Request batcher - groups multiple requests together
 */
export class RequestBatcher<T, R> {
  private pending = new Map<string, PendingRequest<R>[]>();
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private batchDelayMs: number = 50,
  ) {}

  async add(item: T): Promise<R> {
    const key = JSON.stringify(item);
    
    return new Promise((resolve, reject) => {
      if (!this.pending.has(key)) {
        this.pending.set(key, []);
      }
      this.pending.get(key)!.push({ resolve, reject });

      if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.batchDelayMs);
      }
    });
  }

  private async flush(): Promise<void> {
    this.timeoutId = null;
    const entries = Array.from(this.pending.entries());
    this.pending.clear();

    const items = entries.map(([key]) => JSON.parse(key));
    const keys = entries.map(([key]) => key);

    try {
      const results = await this.processor(items);
      keys.forEach((key, i) => {
        const resolvers = entries.find(([k]) => k === key)?.[1];
        const result = results[i];
        if (resolvers && result !== undefined) {
          resolvers.forEach((r) => r.resolve(result));
        }
      });
    } catch (error) {
      keys.forEach((key) => {
        const resolvers = entries.find(([k]) => k === key)?.[1];
        if (resolvers) {
          resolvers.forEach((r) => r.reject(error));
        }
      });
    }
  }
}

/**
 * Lazy import helper for code splitting
 */
export async function lazyImport<T>(modulePath: string): Promise<T> {
  const module = await import(modulePath);
  return module.default ?? module;
}

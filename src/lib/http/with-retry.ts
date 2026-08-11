export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const withTimeout = async <T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  now: () => number,
): Promise<T> => {
  const started = now();
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `Operation timed out after ${timeoutMs}ms (started ${started})`,
          ),
        );
      }, timeoutMs);
    }),
  ]);
};

/** Retry transient external API failures with exponential backoff + timeout. */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> => {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const baseDelayMs = options.baseDelayMs ?? 50;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const shouldRetry =
    options.shouldRetry ??
    ((error: unknown) =>
      error instanceof TimeoutError ||
      (error instanceof Error &&
        /unavailable|rate limit|timeout/i.test(error.message)));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await withTimeout(operation, timeoutMs, now);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !shouldRetry(error)) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
};

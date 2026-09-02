export type RetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
};

const DEFAULT_SHOULD_RETRY = (error: unknown): boolean => {
  if (error instanceof Response) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error) {
    return error.message.includes("fetch") || error.message.includes("network");
  }
  return false;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30_000;
  const shouldRetry = options.shouldRetry ?? DEFAULT_SHOULD_RETRY;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      options.onRetry?.(error, attempt, delayMs);
      await delay(delayMs);
    }
  }
  throw lastError;
}

export async function sleep(ms: number): Promise<void> {
  return delay(ms);
}

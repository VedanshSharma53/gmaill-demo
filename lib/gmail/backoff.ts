const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 403 || status === 500 || status === 503;
}

export async function withGmailBackoff<T>(
  fn: () => Promise<T>,
  label = "gmail-api"
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code: unknown }).code === "number"
          ? (error as { code: number }).code
          : 0;

      if (!isRetryable(status) || attempt === MAX_ATTEMPTS - 1) {
        throw error;
      }

      const jitter = Math.random() * 200;
      const delay = Math.min(
        BASE_DELAY_MS * 2 ** attempt + jitter,
        MAX_DELAY_MS
      );
      console.warn(`[${label}] retry ${attempt + 1} after ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  throw lastError;
}

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export const gmailSemaphore = new Semaphore(5);

export async function withGmailConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  await gmailSemaphore.acquire();
  try {
    return await fn();
  } finally {
    gmailSemaphore.release();
  }
}

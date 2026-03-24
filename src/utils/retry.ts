import { logger } from "./logger.js"

export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  shouldRetry: (error: unknown) => boolean
}

const DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 100,
  shouldRetry: () => true,
}

function addJitter(delay: number): number {
  // ±25% random jitter to prevent thundering herd
  const jitter = delay * 0.25
  return delay + (Math.random() * 2 - 1) * jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts = { ...DEFAULTS, ...options }
  let lastError: unknown

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
        throw error
      }

      const delay = addJitter(opts.baseDelayMs * 2 ** attempt)

      logger.warn("Retrying after failure", {
        attempt: attempt + 1,
        max_retries: opts.maxRetries,
        delay_ms: Math.round(delay),
        error: error instanceof Error ? error.message : String(error),
      })

      await sleep(delay)
    }
  }

  // Unreachable but satisfies TypeScript
  throw lastError
}

// Predicate for Stripe errors: retry 5xx and network errors, skip 4xx
export function isRetryableStripeError(error: unknown): boolean {
  if (!(error instanceof Error)) return true

  // Stripe errors have a `statusCode` property
  const statusCode = (error as unknown as Record<string, unknown>).statusCode
  if (typeof statusCode === "number") {
    return statusCode >= 500
  }

  // Network errors (ECONNREFUSED, ETIMEDOUT, etc.) should be retried
  const code = (error as unknown as Record<string, unknown>).code
  if (typeof code === "string" && code.startsWith("E")) {
    return true
  }

  // Default: retry unknown errors
  return true
}

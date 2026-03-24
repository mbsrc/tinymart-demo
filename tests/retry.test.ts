import { describe, expect, it, vi } from "vitest"
import { isRetryableStripeError, retryWithBackoff } from "../src/utils/retry.js"

describe("retryWithBackoff", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn(() => Promise.resolve("ok"))
    const result = await retryWithBackoff(fn)
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on failure and returns on eventual success", async () => {
    let calls = 0
    const fn = vi.fn(() => {
      calls++
      if (calls < 3) return Promise.reject(new Error("fail"))
      return Promise.resolve("recovered")
    })

    const result = await retryWithBackoff(fn, { baseDelayMs: 1 })
    expect(result).toBe("recovered")
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("throws after exhausting max retries", async () => {
    const fn = vi.fn(() => Promise.reject(new Error("persistent failure")))

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow(
      "persistent failure",
    )

    // 1 initial + 2 retries = 3 calls
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it("does not retry when shouldRetry returns false", async () => {
    const fn = vi.fn(() => Promise.reject(new Error("non-retryable")))

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1,
        shouldRetry: () => false,
      }),
    ).rejects.toThrow("non-retryable")

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("applies increasing delays between retries", async () => {
    const timestamps: number[] = []

    let calls = 0
    const fn = vi.fn(() => {
      timestamps.push(Date.now())
      calls++
      if (calls <= 3) return Promise.reject(new Error("fail"))
      return Promise.resolve("ok")
    })

    // Use small baseDelay to keep test fast
    await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })

    expect(fn).toHaveBeenCalledTimes(4)

    // Verify delays are increasing (exponential backoff)
    const delay1 = timestamps[1] - timestamps[0]
    const delay2 = timestamps[2] - timestamps[1]
    const delay3 = timestamps[3] - timestamps[2]

    // Each delay should be roughly 2x the previous (with jitter)
    expect(delay2).toBeGreaterThanOrEqual(delay1)
    expect(delay3).toBeGreaterThanOrEqual(delay2)
  })
})

describe("isRetryableStripeError", () => {
  it("returns true for 500 errors", () => {
    const error = Object.assign(new Error("Internal Server Error"), { statusCode: 500 })
    expect(isRetryableStripeError(error)).toBe(true)
  })

  it("returns true for 502 errors", () => {
    const error = Object.assign(new Error("Bad Gateway"), { statusCode: 502 })
    expect(isRetryableStripeError(error)).toBe(true)
  })

  it("returns false for 400 errors", () => {
    const error = Object.assign(new Error("Bad Request"), { statusCode: 400 })
    expect(isRetryableStripeError(error)).toBe(false)
  })

  it("returns false for 402 errors (card declined)", () => {
    const error = Object.assign(new Error("Card declined"), { statusCode: 402 })
    expect(isRetryableStripeError(error)).toBe(false)
  })

  it("returns false for 404 errors", () => {
    const error = Object.assign(new Error("Not Found"), { statusCode: 404 })
    expect(isRetryableStripeError(error)).toBe(false)
  })

  it("returns true for network errors", () => {
    const error = Object.assign(new Error("Connection refused"), { code: "ECONNREFUSED" })
    expect(isRetryableStripeError(error)).toBe(true)
  })

  it("returns true for timeout errors", () => {
    const error = Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" })
    expect(isRetryableStripeError(error)).toBe(true)
  })

  it("returns true for unknown errors", () => {
    expect(isRetryableStripeError(new Error("unknown"))).toBe(true)
  })

  it("returns true for non-Error values", () => {
    expect(isRetryableStripeError("string error")).toBe(true)
  })
})

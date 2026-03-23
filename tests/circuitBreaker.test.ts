import { describe, expect, it, vi } from "vitest"
import { AppError } from "../src/types/index.js"
import { CircuitBreaker } from "../src/utils/circuitBreaker.js"

function makeBreaker(overrides?: Record<string, unknown>) {
  return new CircuitBreaker({
    name: "test",
    failureThreshold: 3,
    resetTimeoutMs: 1000,
    halfOpenMaxAttempts: 1,
    ...overrides,
  })
}

describe("CircuitBreaker", () => {
  it("starts in closed state", () => {
    const cb = makeBreaker()
    expect(cb.getState()).toBe("closed")
  })

  it("passes through successful calls in closed state", async () => {
    const cb = makeBreaker()
    const result = await cb.execute(() => Promise.resolve("ok"))
    expect(result).toBe("ok")
    expect(cb.getState()).toBe("closed")
  })

  it("stays closed below failure threshold", async () => {
    const cb = makeBreaker()

    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail")
    }

    expect(cb.getState()).toBe("closed")
  })

  it("opens after reaching failure threshold", async () => {
    const cb = makeBreaker()

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow("fail")
    }

    expect(cb.getState()).toBe("open")
  })

  it("rejects immediately when open", async () => {
    const cb = makeBreaker()

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    const fn = vi.fn(() => Promise.resolve("ok"))
    await expect(cb.execute(fn)).rejects.toThrow(AppError)
    expect(fn).not.toHaveBeenCalled()

    const error = await cb.execute(fn).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).code).toBe("CIRCUIT_OPEN")
    expect((error as AppError).statusCode).toBe(503)
  })

  it("transitions to half_open after reset timeout", async () => {
    vi.useFakeTimers()

    const cb = makeBreaker()

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }
    expect(cb.getState()).toBe("open")

    vi.advanceTimersByTime(1000)

    // Next call should be allowed (half_open probe)
    const result = await cb.execute(() => Promise.resolve("recovered"))
    expect(result).toBe("recovered")
    expect(cb.getState()).toBe("closed")

    vi.useRealTimers()
  })

  it("returns to open if half_open probe fails", async () => {
    vi.useFakeTimers()

    const cb = makeBreaker()

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    vi.advanceTimersByTime(1000)

    await expect(cb.execute(() => Promise.reject(new Error("still broken")))).rejects.toThrow(
      "still broken",
    )
    expect(cb.getState()).toBe("open")

    vi.useRealTimers()
  })

  it("resets failure count after successful call", async () => {
    const cb = makeBreaker()

    // 2 failures (below threshold)
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    // 1 success resets count
    await cb.execute(() => Promise.resolve("ok"))

    // 2 more failures should NOT open the circuit
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    expect(cb.getState()).toBe("closed")
  })

  it("limits half_open attempts", async () => {
    vi.useFakeTimers()

    const cb = makeBreaker({ halfOpenMaxAttempts: 1 })

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    vi.advanceTimersByTime(1000)

    // First half_open attempt — allowed but fails
    await expect(cb.execute(() => Promise.reject(new Error("probe fail")))).rejects.toThrow(
      "probe fail",
    )
    expect(cb.getState()).toBe("open")

    vi.useRealTimers()
  })

  it("getStatus returns correct state details", async () => {
    const cb = makeBreaker()
    const status = cb.getStatus()

    expect(status.state).toBe("closed")
    expect(status.failureCount).toBe(0)
    expect(status.lastFailureTime).toBeNull()
    expect(status.nextRetryTime).toBeNull()
  })

  it("getStatus shows failure info when open", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"))

    const cb = makeBreaker()

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(() => Promise.reject(new Error("fail")))).rejects.toThrow()
    }

    const status = cb.getStatus()
    expect(status.state).toBe("open")
    expect(status.failureCount).toBe(3)
    expect(status.lastFailureTime).toBe("2026-03-23T12:00:00.000Z")
    expect(status.nextRetryTime).toBe("2026-03-23T12:00:01.000Z")

    vi.useRealTimers()
  })
})

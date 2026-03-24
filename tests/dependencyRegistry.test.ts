import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DependencyRegistry } from "../src/services/dependencyRegistry.js"

// Use a fresh instance per test instead of the singleton
function makeRegistry() {
  // Access the class directly — we test behavior, not the singleton
  return new DependencyRegistry()
}

// Need to export the class for direct instantiation in tests
// We'll use a workaround: import the module and create instances

describe("DependencyRegistry", () => {
  let registry: DependencyRegistry

  beforeEach(() => {
    registry = makeRegistry()
  })

  afterEach(() => {
    registry.stopMonitoring()
  })

  it("returns unavailable for unregistered dependencies", () => {
    expect(registry.getStatus("unknown")).toBe("unavailable")
    expect(registry.getInfo("unknown")).toBeNull()
    expect(registry.isHealthy("unknown")).toBe(false)
  })

  it("registers and checks a healthy dependency", async () => {
    registry.register("test-db", async () => "healthy")

    const status = await registry.checkOne("test-db")
    expect(status).toBe("healthy")
    expect(registry.isHealthy("test-db")).toBe(true)
  })

  it("registers and checks a degraded dependency", async () => {
    registry.register("test-stripe", async () => "degraded")

    const status = await registry.checkOne("test-stripe")
    expect(status).toBe("degraded")
    expect(registry.isHealthy("test-stripe")).toBe(false)
  })

  it("marks dependency unavailable when health check throws", async () => {
    registry.register("test-failing", async () => {
      throw new Error("connection refused")
    })

    const status = await registry.checkOne("test-failing")
    expect(status).toBe("unavailable")

    const info = registry.getInfo("test-failing")
    expect(info?.status).toBe("unavailable")
    expect(info?.lastError).toBe("connection refused")
    expect(info?.lastChecked).toBeDefined()
  })

  it("checkAll updates all dependencies", async () => {
    registry.register("dep-a", async () => "healthy")
    registry.register("dep-b", async () => "degraded")
    registry.register("dep-c", async () => {
      throw new Error("down")
    })

    await registry.checkAll()

    expect(registry.getStatus("dep-a")).toBe("healthy")
    expect(registry.getStatus("dep-b")).toBe("degraded")
    expect(registry.getStatus("dep-c")).toBe("unavailable")
  })

  it("getAllStatuses returns info for all dependencies", async () => {
    registry.register("dep-a", async () => "healthy")
    registry.register("dep-b", async () => "degraded")

    await registry.checkAll()
    const all = registry.getAllStatuses()

    expect(Object.keys(all)).toEqual(["dep-a", "dep-b"])
    expect(all["dep-a"].status).toBe("healthy")
    expect(all["dep-b"].status).toBe("degraded")
  })

  it("clears error after successful check", async () => {
    let shouldFail = true
    registry.register("flaky", async () => {
      if (shouldFail) throw new Error("boom")
      return "healthy"
    })

    await registry.checkOne("flaky")
    expect(registry.getInfo("flaky")?.lastError).toBe("boom")

    shouldFail = false
    await registry.checkOne("flaky")
    expect(registry.getInfo("flaky")?.lastError).toBeNull()
    expect(registry.getInfo("flaky")?.status).toBe("healthy")
  })

  it("startMonitoring runs periodic checks", async () => {
    vi.useFakeTimers()

    let callCount = 0
    registry.register("counter", async () => {
      callCount++
      return "healthy"
    })

    registry.startMonitoring(100)

    // Initial check fires immediately (async)
    await vi.advanceTimersByTimeAsync(0)
    const initialCount = callCount

    await vi.advanceTimersByTimeAsync(100)
    expect(callCount).toBeGreaterThan(initialCount)

    registry.stopMonitoring()
    vi.useRealTimers()
  })

  it("stopMonitoring halts periodic checks", async () => {
    vi.useFakeTimers()

    let callCount = 0
    registry.register("counter", async () => {
      callCount++
      return "healthy"
    })

    registry.startMonitoring(100)
    await vi.advanceTimersByTimeAsync(0)

    registry.stopMonitoring()
    const countAfterStop = callCount

    await vi.advanceTimersByTimeAsync(500)
    expect(callCount).toBe(countAfterStop)

    vi.useRealTimers()
  })
})

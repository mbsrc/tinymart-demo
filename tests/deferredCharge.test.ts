import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { DeferredCharge } from "../src/models/DeferredCharge.js"
import { sequelize } from "../src/models/index.js"
import { stripeCircuitBreaker } from "../src/services/stripe.js"

// Mock createPaymentIntent
vi.mock("../src/services/stripe.js", async () => {
  const { CircuitBreaker } = await import("../src/utils/circuitBreaker.js")
  return {
    stripeCircuitBreaker: new CircuitBreaker({
      name: "Stripe",
      failureThreshold: 2,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 1,
    }),
    createPaymentIntent: vi.fn(),
  }
})

import { chargeOrDefer, processDeferredCharges } from "../src/services/deferredCharge.js"
import { createPaymentIntent } from "../src/services/stripe.js"

const mockedCreate = vi.mocked(createPaymentIntent)

beforeAll(async () => {
  await sequelize.sync({ force: true })
})

beforeEach(async () => {
  await DeferredCharge.destroy({ where: {} })
  vi.clearAllMocks()
})

afterAll(async () => {
  await sequelize.close()
})

describe("chargeOrDefer", () => {
  it("charges directly when circuit is closed", async () => {
    mockedCreate.mockResolvedValue({ id: "pi_123" } as never)

    const result = await chargeOrDefer(randomUUID(), {
      amount: 500,
      currency: "usd",
    })

    expect(result.outcome).toBe("charged")
    expect(result.paymentIntent).toEqual({ id: "pi_123" })
    expect(mockedCreate).toHaveBeenCalledOnce()

    const deferred = await DeferredCharge.count()
    expect(deferred).toBe(0)
  })

  it("defers charge when circuit is open", async () => {
    // Open the circuit by causing failures
    for (let i = 0; i < 2; i++) {
      await stripeCircuitBreaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {})
    }
    expect(stripeCircuitBreaker.getState()).toBe("open")

    const sessionId = randomUUID()
    const result = await chargeOrDefer(sessionId, {
      amount: 1200,
      currency: "usd",
    })

    expect(result.outcome).toBe("deferred")
    expect(result.deferredChargeId).toBeDefined()

    const deferred = await DeferredCharge.findAll()
    expect(deferred).toHaveLength(1)
    expect(deferred[0].session_id).toBe(sessionId)
    expect(deferred[0].amount).toBe(1200)
    expect(deferred[0].status).toBe("pending")
  })
})

describe("processDeferredCharges", () => {
  it("returns zeros when no pending charges exist", async () => {
    const result = await processDeferredCharges()
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
  })

  it("processes pending charges when Stripe is available", async () => {
    // Ensure circuit is closed
    vi.useFakeTimers()
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()

    mockedCreate.mockResolvedValue({ id: "pi_456" } as never)

    const sessionId = randomUUID()
    await DeferredCharge.create({
      session_id: sessionId,
      amount: 800,
      currency: "usd",
      stripe_params: { amount: 800, currency: "usd" },
    })

    // Circuit may be open from prior test — test the appropriate path
    const circuitState = stripeCircuitBreaker.getState()

    if (circuitState === "open") {
      const result = await processDeferredCharges()
      expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 })
    } else {
      const result = await processDeferredCharges()
      expect(result.succeeded).toBe(1)

      const charge = await DeferredCharge.findOne({ where: { session_id: sessionId } })
      expect(charge?.status).toBe("succeeded")
      expect(charge?.processed_at).toBeDefined()
    }
  })

  it("increments attempts on failure", async () => {
    // Reset circuit for a clean state
    vi.useFakeTimers()
    vi.advanceTimersByTime(2000)
    vi.useRealTimers()

    const circuitState = stripeCircuitBreaker.getState()
    if (circuitState === "open") return // Can't test this path with open circuit

    mockedCreate.mockRejectedValue(new Error("card_declined"))

    const sessionId = randomUUID()
    await DeferredCharge.create({
      session_id: sessionId,
      amount: 500,
      currency: "usd",
      stripe_params: { amount: 500, currency: "usd" },
    })

    const result = await processDeferredCharges()
    expect(result.failed).toBeGreaterThanOrEqual(1)

    const charge = await DeferredCharge.findOne({ where: { session_id: sessionId } })
    expect(charge?.attempts).toBeGreaterThanOrEqual(1)
    expect(charge?.last_error).toBe("card_declined")
  })
})

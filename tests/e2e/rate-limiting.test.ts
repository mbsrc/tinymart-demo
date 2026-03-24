import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { resetRateLimiter } from "../../src/middleware/rateLimiter.js"
import { app, createOperator, request, sequelize } from "./helpers.js"

let headersA: Record<string, string>
let headersB: Record<string, string>

const LIMIT = 100

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctxA = await createOperator("Rate Op A")
  const ctxB = await createOperator("Rate Op B")
  headersA = ctxA.headers
  headersB = ctxB.headers
})

afterEach(() => {
  resetRateLimiter()
})

afterAll(async () => {
  await sequelize.close()
})

describe("Rate limiting", () => {
  describe("Burst past the limit", () => {
    it("first 100 requests succeed, 101st returns 429", async () => {
      const promises = Array.from({ length: LIMIT + 1 }, () =>
        request(app).get("/api/stores").set(headersA),
      )
      const results = await Promise.all(promises)

      const ok = results.filter((r) => r.status === 200)
      const limited = results.filter((r) => r.status === 429)

      expect(ok).toHaveLength(LIMIT)
      expect(limited).toHaveLength(1)

      const blocked = limited[0]
      expect(blocked.headers["retry-after"]).toBeDefined()
      expect(blocked.body.error.code).toBe("RATE_LIMIT_EXCEEDED")
    })

    it("X-RateLimit-Remaining decrements correctly", async () => {
      const first = await request(app).get("/api/stores").set(headersA)
      expect(Number(first.headers["x-ratelimit-limit"])).toBe(LIMIT)
      expect(Number(first.headers["x-ratelimit-remaining"])).toBe(LIMIT - 1)

      const second = await request(app).get("/api/stores").set(headersA)
      expect(Number(second.headers["x-ratelimit-remaining"])).toBe(LIMIT - 2)
    })
  })

  describe("Rate limit is per API key", () => {
    it("Operator A exhausted, Operator B still gets 200", async () => {
      // Exhaust Operator A's limit
      const flood = Array.from({ length: LIMIT }, () =>
        request(app).get("/api/stores").set(headersA),
      )
      await Promise.all(flood)

      // A is now blocked
      const blockedRes = await request(app).get("/api/stores").set(headersA)
      expect(blockedRes.status).toBe(429)

      // B is independent
      const okRes = await request(app).get("/api/stores").set(headersB)
      expect(okRes.status).toBe(200)
    })
  })

  describe("Health endpoints bypass rate limiter", () => {
    it("GET /health still responds after operator is rate-limited", async () => {
      // Exhaust an operator's limit
      const flood = Array.from({ length: LIMIT }, () =>
        request(app).get("/api/stores").set(headersA),
      )
      await Promise.all(flood)

      const blockedRes = await request(app).get("/api/stores").set(headersA)
      expect(blockedRes.status).toBe(429)

      // Health is before rate limiter in middleware order
      const healthRes = await request(app).get("/health")
      expect(healthRes.status).toBe(200)
    })
  })
})

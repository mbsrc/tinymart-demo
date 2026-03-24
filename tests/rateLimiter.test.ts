import request from "supertest"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { resetRateLimiter } from "../src/middleware/rateLimiter.js"
import { Operator, sequelize } from "../src/models/index.js"

let apiKey: string

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Rate Limit Op",
    email: "ratelimit@example.com",
    api_key: "test-key-ratelimit",
  })
  apiKey = op.api_key
})

afterEach(() => {
  resetRateLimiter()
})

afterAll(async () => {
  await sequelize.close()
})

describe("Rate limiter", () => {
  it("allows requests under the limit", async () => {
    const res = await request(app).get("/api/stores").set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.headers["x-ratelimit-limit"]).toBeDefined()
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined()
  })

  it("returns rate limit headers on every response", async () => {
    const res = await request(app).get("/api/stores").set("x-api-key", apiKey)

    expect(Number(res.headers["x-ratelimit-limit"])).toBe(100)
    expect(Number(res.headers["x-ratelimit-remaining"])).toBe(99)
  })

  it("returns 429 when limit is exceeded", async () => {
    // Override config for this test — send requests rapidly
    // Default is 100/60s, so we send 101 requests
    const promises = Array.from({ length: 101 }, () =>
      request(app).get("/api/stores").set("x-api-key", apiKey),
    )
    const responses = await Promise.all(promises)

    const ok = responses.filter((r) => r.status === 200)
    const limited = responses.filter((r) => r.status === 429)

    expect(ok.length).toBe(100)
    expect(limited.length).toBe(1)
  })

  it("returns proper error envelope on 429", async () => {
    // Fill up the window
    const fill = Array.from({ length: 100 }, () =>
      request(app).get("/api/stores").set("x-api-key", apiKey),
    )
    await Promise.all(fill)

    const res = await request(app).get("/api/stores").set("x-api-key", apiKey)

    expect(res.status).toBe(429)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(res.body.error.retry_after).toBeGreaterThan(0)
    expect(res.headers["retry-after"]).toBeDefined()
    expect(res.headers["x-ratelimit-remaining"]).toBe("0")
  })

  it("does not rate limit health endpoints", async () => {
    // Health routes are mounted before the rate limiter
    const fill = Array.from({ length: 100 }, () =>
      request(app).get("/api/stores").set("x-api-key", apiKey),
    )
    await Promise.all(fill)

    // Health should still work even after the API limit is hit
    const health = await request(app).get("/health")
    expect(health.status).toBe(200)
  })

  it("tracks limits per API key independently", async () => {
    const otherOp = await Operator.create({
      name: "Other Rate Op",
      email: "ratelimit2@example.com",
      api_key: "test-key-ratelimit-2",
    })

    // Fill up the first key's window
    const fill = Array.from({ length: 100 }, () =>
      request(app).get("/api/stores").set("x-api-key", apiKey),
    )
    await Promise.all(fill)

    // First key is limited
    const limited = await request(app).get("/api/stores").set("x-api-key", apiKey)
    expect(limited.status).toBe(429)

    // Second key should still work
    const ok = await request(app).get("/api/stores").set("x-api-key", otherOp.api_key)
    expect(ok.status).toBe(200)
  })
})

import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { resetRateLimiter } from "../../src/middleware/rateLimiter.js"
import { dependencyRegistry } from "../../src/services/dependencyRegistry.js"
import { app, createOperator, idemKey, request, sequelize } from "./helpers.js"

let headers: Record<string, string>
let storeId: string
let productId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctx = await createOperator("Envelope Op")
  headers = ctx.headers

  dependencyRegistry.register("database", async () => {
    await sequelize.authenticate()
    return "healthy"
  })
  dependencyRegistry.register("stripe", async () => "healthy")
  dependencyRegistry.register("job_queue", async () => "healthy")

  // Create shared fixtures for GET/PATCH tests
  const prodRes = await request(app)
    .post("/api/products")
    .set({ ...headers, ...idemKey() })
    .send({ name: "Envelope Prod", sku: "ENV-001", price_cents: 100, category: "pantry" })
  productId = prodRes.body.data.id

  const storeRes = await request(app)
    .post("/api/stores")
    .set({ ...headers, ...idemKey() })
    .send({ name: "Envelope Store" })
  storeId = storeRes.body.data.id

  await request(app)
    .post(`/api/stores/${storeId}/products`)
    .set({ ...headers, ...idemKey() })
    .send({ product_id: productId, quantity_on_hand: 10 })
})

afterAll(async () => {
  dependencyRegistry.stopMonitoring()
  resetRateLimiter()
  await sequelize.close()
})

function expectSuccessEnvelope(body: Record<string, unknown>): void {
  expect(body.success).toBe(true)
  expect(body.data).not.toBeNull()
  expect(body.error).toBeNull()
  expect(body.meta).toBeDefined()
  const meta = body.meta as Record<string, unknown>
  expect(meta.correlation_id).toBeDefined()
  expect(typeof meta.timestamp).toBe("string")
}

function expectErrorEnvelope(body: Record<string, unknown>): void {
  expect(body.success).toBe(false)
  expect(body.data).toBeNull()
  expect(body.error).not.toBeNull()
  const error = body.error as Record<string, unknown>
  expect(typeof error.code).toBe("string")
  expect(typeof error.message).toBe("string")
  expect(body.meta).toBeDefined()
  const meta = body.meta as Record<string, unknown>
  expect(meta.correlation_id).toBeDefined()
  expect(typeof meta.timestamp).toBe("string")
}

describe("Response envelope consistency", () => {
  describe("All success responses have correct envelope shape", () => {
    it("GET /api/products (list)", async () => {
      const res = await request(app).get("/api/products").set(headers)
      expect(res.status).toBe(200)
      expectSuccessEnvelope(res.body)
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it("POST /api/products (create)", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, ...idemKey() })
        .send({ name: "Envelope Test 2", sku: "ENV-002", price_cents: 200, category: "fridge" })
      expect(res.status).toBe(201)
      expectSuccessEnvelope(res.body)
    })

    it("GET /api/stores/:id (detail)", async () => {
      const res = await request(app).get(`/api/stores/${storeId}`).set(headers)
      expect(res.status).toBe(200)
      expectSuccessEnvelope(res.body)
    })

    it("PATCH /api/stores/:id/products/:productId (update)", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, ...idemKey() })
        .send({ quantity_on_hand: 12 })
      expect(res.status).toBe(200)
      expectSuccessEnvelope(res.body)
    })

    it("GET /health (liveness)", async () => {
      const res = await request(app).get("/health")
      expect(res.status).toBe(200)
      expectSuccessEnvelope(res.body)
    })
  })

  describe("All error responses have correct envelope shape", () => {
    it("400 validation error", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, ...idemKey() })
        .send({ sku: "NO-NAME", price_cents: 100, category: "pantry" })
      expect(res.status).toBe(400)
      expectErrorEnvelope(res.body)
    })

    it("401 unauthorized", async () => {
      const res = await request(app).get("/api/stores")
      expect(res.status).toBe(401)
      expectErrorEnvelope(res.body)
    })

    it("404 not found", async () => {
      const res = await request(app).get("/api/nonexistent").set(headers)
      expect(res.status).toBe(404)
      expectErrorEnvelope(res.body)
    })

    it("409 conflict (insufficient stock)", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, ...idemKey() })
        .send({ quantity_on_hand: -999 })
      expect(res.status).toBe(409)
      expectErrorEnvelope(res.body)
    })

    it("429 rate limit", async () => {
      // Exhaust the rate limit
      const flood = Array.from({ length: 100 }, () => request(app).get("/api/stores").set(headers))
      await Promise.all(flood)

      const res = await request(app).get("/api/stores").set(headers)
      expect(res.status).toBe(429)
      expectErrorEnvelope(res.body)
    })
  })

  describe("Timestamps are valid ISO 8601", () => {
    it("meta.timestamp parses as a valid date on every response", async () => {
      resetRateLimiter()

      const responses = await Promise.all([
        request(app).get("/api/products").set(headers),
        request(app).get("/health"),
        request(app).get("/api/nonexistent").set(headers),
      ])

      for (const res of responses) {
        const ts = res.body.meta.timestamp
        expect(typeof ts).toBe("string")
        const parsed = new Date(ts)
        expect(parsed.getTime()).not.toBeNaN()
      }
    })
  })
})

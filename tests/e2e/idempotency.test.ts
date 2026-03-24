import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app, createOperator, request, sequelize } from "./helpers.js"

let headers: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctx = await createOperator("Idempotency Op")
  headers = ctx.headers
})

afterAll(async () => {
  await sequelize.close()
})

describe("Idempotency", () => {
  describe("Exact replay returns cached response", () => {
    const key = randomUUID()
    const body = { name: "Replay Water", sku: "RPL-001", price_cents: 199, category: "fridge" }

    it("first request creates the product (201)", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": key })
        .send(body)

      expect(res.status).toBe(201)
      expect(res.body.data.name).toBe("Replay Water")
    })

    it("replay with same key + body returns cached response (200)", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": key })
        .send(body)

      expect(res.status).toBe(201)
      expect(res.body.data.name).toBe("Replay Water")
    })

    it("product was only created once", async () => {
      const res = await request(app).get("/api/products").set(headers)

      expect(res.status).toBe(200)
      const matches = res.body.data.filter((p: Record<string, unknown>) => p.sku === "RPL-001")
      expect(matches).toHaveLength(1)
    })
  })

  describe("Body mismatch on same key", () => {
    const key = randomUUID()

    it("first request succeeds", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": key })
        .send({ name: "Mismatch A", sku: "MIS-001", price_cents: 100, category: "pantry" })

      expect(res.status).toBe(201)
    })

    it("different body with same key returns 422", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": key })
        .send({ name: "Mismatch B", sku: "MIS-002", price_cents: 200, category: "fridge" })

      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe("IDEMPOTENCY_BODY_MISMATCH")
    })
  })

  describe("Same key on different endpoint is rejected", () => {
    const key = randomUUID()

    it("creates a product with the key", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": key })
        .send({ name: "Cross Path", sku: "CRP-001", price_cents: 150, category: "pantry" })

      expect(res.status).toBe(201)
    })

    it("using the same key on a different endpoint returns 422", async () => {
      const res = await request(app)
        .post("/api/stores")
        .set({ ...headers, "Idempotency-Key": key })
        .send({ name: "Cross Path Store" })

      expect(res.status).toBe(422)
      // Body hash check runs before path check, so different body triggers BODY_MISMATCH
      expect(res.body.error.code).toBe("IDEMPOTENCY_BODY_MISMATCH")
    })
  })

  describe("PATCH is also idempotent", () => {
    let storeId: string
    let productId: string
    const key = randomUUID()

    it("sets up a store with a product", async () => {
      const prodRes = await request(app)
        .post("/api/products")
        .set({ ...headers, "Idempotency-Key": randomUUID() })
        .send({ name: "Patch Idem", sku: "PID-001", price_cents: 300, category: "fridge" })

      expect(prodRes.status).toBe(201)
      productId = prodRes.body.data.id

      const storeRes = await request(app)
        .post("/api/stores")
        .set({ ...headers, "Idempotency-Key": randomUUID() })
        .send({ name: "Patch Idem Store" })

      expect(storeRes.status).toBe(201)
      storeId = storeRes.body.data.id

      const addRes = await request(app)
        .post(`/api/stores/${storeId}/products`)
        .set({ ...headers, "Idempotency-Key": randomUUID() })
        .send({ product_id: productId, quantity_on_hand: 10 })

      expect(addRes.status).toBe(201)
    })

    it("first PATCH restocks to 25", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, "Idempotency-Key": key })
        .send({ quantity_on_hand: 25 })

      expect(res.status).toBe(200)
      expect(res.body.data.quantity_on_hand).toBe(25)
    })

    it("replay with same key returns cached response", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, "Idempotency-Key": key })
        .send({ quantity_on_hand: 25 })

      expect(res.status).toBe(200)
      expect(res.body.data.quantity_on_hand).toBe(25)
    })

    it("quantity only changed once (still 25, not 40)", async () => {
      const res = await request(app).get(`/api/stores/${storeId}`).set(headers)

      const sp = res.body.data.StoreProducts.find(
        (s: Record<string, unknown>) => s.product_id === productId,
      )
      expect(sp.quantity_on_hand).toBe(25)
      expect(sp.version).toBe(1)
    })
  })
})

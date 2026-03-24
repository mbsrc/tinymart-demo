import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app, createOperator, idemKey, request, sequelize } from "./helpers.js"

let headersA: Record<string, string>
let headersB: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctxA = await createOperator("Operator A")
  const ctxB = await createOperator("Operator B")
  headersA = ctxA.headers
  headersB = ctxB.headers
})

afterAll(async () => {
  await sequelize.close()
})

describe("Auth and operator isolation", () => {
  describe("No API key", () => {
    it("GET /api/stores without x-api-key returns 401", async () => {
      const res = await request(app).get("/api/stores")

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe("UNAUTHORIZED")
    })

    it("POST /api/products without x-api-key returns 401", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ "Content-Type": "application/json" })
        .send({ name: "No Auth", sku: "NA-001", price_cents: 100, category: "pantry" })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Invalid API key", () => {
    it("GET /api/stores with bogus key returns 401", async () => {
      const res = await request(app)
        .get("/api/stores")
        .set({ "x-api-key": "bogus-key-that-does-not-exist" })

      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Operator A cannot see Operator B's resources", () => {
    let storeA: string
    let storeB: string
    let productA: string
    let productB: string

    it("both operators create products and stores", async () => {
      const prodA = await request(app)
        .post("/api/products")
        .set({ ...headersA, ...idemKey() })
        .send({ name: "Product A", sku: "OPA-001", price_cents: 100, category: "pantry" })
      expect(prodA.status).toBe(201)
      productA = prodA.body.data.id

      const prodB = await request(app)
        .post("/api/products")
        .set({ ...headersB, ...idemKey() })
        .send({ name: "Product B", sku: "OPB-001", price_cents: 200, category: "fridge" })
      expect(prodB.status).toBe(201)
      productB = prodB.body.data.id

      const sA = await request(app)
        .post("/api/stores")
        .set({ ...headersA, ...idemKey() })
        .send({ name: "Store A" })
      expect(sA.status).toBe(201)
      storeA = sA.body.data.id

      const sB = await request(app)
        .post("/api/stores")
        .set({ ...headersB, ...idemKey() })
        .send({ name: "Store B" })
      expect(sB.status).toBe(201)
      storeB = sB.body.data.id
    })

    it("Operator A lists only their own stores", async () => {
      const res = await request(app).get("/api/stores").set(headersA)

      expect(res.status).toBe(200)
      const names = res.body.data.map((s: Record<string, unknown>) => s.name)
      expect(names).toContain("Store A")
      expect(names).not.toContain("Store B")
    })

    it("Operator A lists only their own products", async () => {
      const res = await request(app).get("/api/products").set(headersA)

      expect(res.status).toBe(200)
      const names = res.body.data.map((p: Record<string, unknown>) => p.name)
      expect(names).toContain("Product A")
      expect(names).not.toContain("Product B")
    })

    it("Operator A GET store B returns 404", async () => {
      const res = await request(app).get(`/api/stores/${storeB}`).set(headersA)

      expect(res.status).toBe(404)
    })

    it("Operator A POST product to store B returns 404", async () => {
      const res = await request(app)
        .post(`/api/stores/${storeB}/products`)
        .set({ ...headersA, ...idemKey() })
        .send({ product_id: productA, quantity_on_hand: 5 })

      expect(res.status).toBe(404)
    })

    it("Operator A cannot add Operator B's product to their own store", async () => {
      const res = await request(app)
        .post(`/api/stores/${storeA}/products`)
        .set({ ...headersA, ...idemKey() })
        .send({ product_id: productB, quantity_on_hand: 5 })

      expect(res.status).toBe(404)
    })
  })

  describe("Operator B cannot access Operator A's inventory events", () => {
    let storeA: string
    let productA: string

    it("Operator A creates product, adds to store, and restocks", async () => {
      const prodRes = await request(app)
        .post("/api/products")
        .set({ ...headersA, ...idemKey() })
        .send({ name: "Event Guard", sku: "EVG-001", price_cents: 150, category: "fridge" })
      expect(prodRes.status).toBe(201)
      productA = prodRes.body.data.id

      const storeRes = await request(app)
        .post("/api/stores")
        .set({ ...headersA, ...idemKey() })
        .send({ name: "Event Guard Store" })
      expect(storeRes.status).toBe(201)
      storeA = storeRes.body.data.id

      const addRes = await request(app)
        .post(`/api/stores/${storeA}/products`)
        .set({ ...headersA, ...idemKey() })
        .send({ product_id: productA, quantity_on_hand: 0 })
      expect(addRes.status).toBe(201)

      const restockRes = await request(app)
        .patch(`/api/stores/${storeA}/products/${productA}`)
        .set({ ...headersA, ...idemKey() })
        .send({ quantity_on_hand: 10 })
      expect(restockRes.status).toBe(200)
    })

    it("Operator B GET events for A's store product returns 404", async () => {
      const res = await request(app)
        .get(`/api/stores/${storeA}/products/${productA}/events`)
        .set(headersB)

      expect(res.status).toBe(404)
    })
  })
})

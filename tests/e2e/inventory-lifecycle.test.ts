import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app, createOperator, idemKey, request, sequelize } from "./helpers.js"

let headers: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctx = await createOperator("Lifecycle Op")
  headers = ctx.headers
})

afterAll(async () => {
  await sequelize.close()
})

describe("Inventory lifecycle", () => {
  describe("Product → Store → Restock → Deduct → Events", () => {
    let productId: string
    let storeId: string
    let storeProductId: string

    it("creates a product", async () => {
      const res = await request(app)
        .post("/api/products")
        .set({ ...headers, ...idemKey() })
        .send({
          name: "Sparkling Water",
          sku: "SPK-001",
          price_cents: 299,
          category: "fridge",
        })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe("Sparkling Water")
      productId = res.body.data.id
    })

    it("creates a store", async () => {
      const res = await request(app)
        .post("/api/stores")
        .set({ ...headers, ...idemKey() })
        .send({ name: "Downtown Kiosk", address: "123 Main St" })

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.name).toBe("Downtown Kiosk")
      storeId = res.body.data.id
    })

    it("adds the product to the store with zero stock", async () => {
      const res = await request(app)
        .post(`/api/stores/${storeId}/products`)
        .set({ ...headers, ...idemKey() })
        .send({ product_id: productId, quantity_on_hand: 0 })

      expect(res.status).toBe(201)
      expect(res.body.data.quantity_on_hand).toBe(0)
      expect(res.body.data.version).toBe(0)
      storeProductId = res.body.data.id
    })

    it("restocks to 20 units", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, ...idemKey() })
        .send({ quantity_on_hand: 20 })

      expect(res.status).toBe(200)
      expect(res.body.data.quantity_on_hand).toBe(20)
      expect(res.body.data.version).toBe(1)
    })

    it("deducts to 15 units", async () => {
      const res = await request(app)
        .patch(`/api/stores/${storeId}/products/${productId}`)
        .set({ ...headers, ...idemKey() })
        .send({ quantity_on_hand: 15 })

      expect(res.status).toBe(200)
      expect(res.body.data.quantity_on_hand).toBe(15)
      expect(res.body.data.version).toBe(2)
    })

    it("shows correct event history", async () => {
      const res = await request(app)
        .get(`/api/stores/${storeId}/products/${productId}/events`)
        .set(headers)

      expect(res.status).toBe(200)
      expect(res.body.data.total).toBe(2)

      const events = res.body.data.events
      // Events are returned in DESC version order
      const restock = events.find((e: Record<string, unknown>) => e.version === 1)
      const adjustment = events.find((e: Record<string, unknown>) => e.version === 2)

      expect(restock.store_product_id).toBe(storeProductId)
      expect(restock.event_type).toBe("restock")
      expect(restock.quantity).toBe(20)

      expect(adjustment.store_product_id).toBe(storeProductId)
      expect(adjustment.event_type).toBe("deduct")
      expect(adjustment.quantity).toBe(-5)
    })
  })
})

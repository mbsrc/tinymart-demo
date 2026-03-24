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

  describe("Multiple products in one store", () => {
    let storeId: string
    const products: { id: string; name: string; qty: number }[] = []

    it("creates 3 products and a store", async () => {
      const items = [
        { name: "Cola", sku: "COLA-001", price_cents: 199, category: "fridge", qty: 10 },
        { name: "Chips", sku: "CHP-001", price_cents: 349, category: "pantry", qty: 25 },
        { name: "Ice Cream", sku: "ICE-001", price_cents: 499, category: "freezer", qty: 8 },
      ]

      for (const item of items) {
        const res = await request(app)
          .post("/api/products")
          .set({ ...headers, ...idemKey() })
          .send({
            name: item.name,
            sku: item.sku,
            price_cents: item.price_cents,
            category: item.category,
          })

        expect(res.status).toBe(201)
        products.push({ id: res.body.data.id, name: item.name, qty: item.qty })
      }

      const storeRes = await request(app)
        .post("/api/stores")
        .set({ ...headers, ...idemKey() })
        .send({ name: "Multi-Product Store" })

      expect(storeRes.status).toBe(201)
      storeId = storeRes.body.data.id
    })

    it("adds all 3 products with different quantities", async () => {
      for (const product of products) {
        const res = await request(app)
          .post(`/api/stores/${storeId}/products`)
          .set({ ...headers, ...idemKey() })
          .send({ product_id: product.id, quantity_on_hand: product.qty })

        expect(res.status).toBe(201)
        expect(res.body.data.quantity_on_hand).toBe(product.qty)
      }
    })

    it("store detail shows all 3 products with correct quantities", async () => {
      const res = await request(app).get(`/api/stores/${storeId}`).set(headers)

      expect(res.status).toBe(200)
      const storeProducts = res.body.data.StoreProducts
      expect(storeProducts).toHaveLength(3)

      for (const product of products) {
        const sp = storeProducts.find((s: Record<string, unknown>) => s.product_id === product.id)
        expect(sp).toBeDefined()
        expect(sp.quantity_on_hand).toBe(product.qty)
      }
    })

    it("adjusting one product does not affect the others", async () => {
      // Restock Cola to 50
      const patchRes = await request(app)
        .patch(`/api/stores/${storeId}/products/${products[0].id}`)
        .set({ ...headers, ...idemKey() })
        .send({ quantity_on_hand: 50 })

      expect(patchRes.status).toBe(200)
      expect(patchRes.body.data.quantity_on_hand).toBe(50)

      // Verify the other two are unchanged
      const storeRes = await request(app).get(`/api/stores/${storeId}`).set(headers)

      const storeProducts = storeRes.body.data.StoreProducts
      const chips = storeProducts.find(
        (s: Record<string, unknown>) => s.product_id === products[1].id,
      )
      const iceCream = storeProducts.find(
        (s: Record<string, unknown>) => s.product_id === products[2].id,
      )

      expect(chips.quantity_on_hand).toBe(25)
      expect(iceCream.quantity_on_hand).toBe(8)
    })
  })
})

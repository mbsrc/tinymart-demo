import { randomUUID } from "node:crypto"
import request from "supertest"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { app } from "../src/app.js"
import { Operator, Product, Session, Store, StoreProduct, sequelize } from "../src/models/index.js"
import { adjustInventory } from "../src/services/inventory.js"

vi.mock("../src/services/deferredCharge.js", () => ({
  chargeOrDefer: vi.fn().mockResolvedValue({
    outcome: "charged",
    paymentIntent: { id: "pi_test_123" },
  }),
}))

function idemKey(): Record<string, string> {
  return { "Idempotency-Key": randomUUID() }
}

let operator: Operator
let operatorHeaders: Record<string, string>
let store: Store
let product: Product
let storeProduct: StoreProduct

beforeAll(async () => {
  await sequelize.sync({ force: true })
})

beforeEach(async () => {
  // Clean tables in dependency order
  await sequelize.query("DELETE FROM inventory_events")
  await sequelize.query("DELETE FROM session_items")
  await sequelize.query("DELETE FROM transactions")
  await sequelize.query("DELETE FROM deferred_charges")
  await sequelize.query("DELETE FROM sessions")
  await sequelize.query("DELETE FROM store_products")
  await sequelize.query("DELETE FROM products")
  await sequelize.query("DELETE FROM stores")
  await sequelize.query("DELETE FROM idempotency_keys")
  await sequelize.query("DELETE FROM operators")

  operator = await Operator.create({
    name: "Test Operator",
    email: `test-${randomUUID()}@example.com`,
    api_key: `key-${randomUUID()}`,
  })

  operatorHeaders = {
    "x-api-key": operator.api_key,
    "Content-Type": "application/json",
  }

  store = await Store.create({
    operator_id: operator.id,
    name: "Test Store",
    status: "online",
  })

  product = await Product.create({
    operator_id: operator.id,
    name: "Test Soda",
    sku: `SKU-${randomUUID()}`,
    price_cents: 250,
    category: "fridge",
  })

  storeProduct = await StoreProduct.create({
    store_id: store.id,
    product_id: product.id,
  })

  // Stock 10 units
  await adjustInventory({
    storeProductId: storeProduct.id,
    eventType: "restock",
    quantity: 10,
  })
})

describe("POST /api/sessions — open session", () => {
  it("opens a session for an online store", async () => {
    const res = await request(app).post("/api/sessions").set(idemKey()).send({ store_id: store.id })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.store_id).toBe(store.id)
    expect(res.body.data.status).toBe("open")
  })

  it("rejects session for offline store", async () => {
    await store.update({ status: "offline" })

    const res = await request(app).post("/api/sessions").set(idemKey()).send({ store_id: store.id })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("STORE_NOT_ONLINE")
  })

  it("rejects session for non-existent store", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .set(idemKey())
      .send({ store_id: randomUUID() })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("STORE_NOT_FOUND")
  })

  it("rejects session without store_id", async () => {
    const res = await request(app).post("/api/sessions").set(idemKey()).send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("POST /api/sessions/:id/items — add/remove items", () => {
  let sessionId: string

  beforeEach(async () => {
    const session = await Session.create({ store_id: store.id })
    sessionId = session.id
  })

  it("adds an item to an open session", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    expect(res.status).toBe(201)
    expect(res.body.data.product_id).toBe(product.id)
    expect(res.body.data.action).toBe("added")
  })

  it("removes an item from an open session", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "removed" })

    expect(res.status).toBe(201)
    expect(res.body.data.action).toBe("removed")
  })

  it("rejects adding to a closed session", async () => {
    await Session.update({ status: "closed" }, { where: { id: sessionId } })

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("SESSION_NOT_OPEN")
  })

  it("rejects product not in the store", async () => {
    const otherProduct = await Product.create({
      operator_id: operator.id,
      name: "Other Product",
      sku: `SKU-${randomUUID()}`,
      price_cents: 100,
      category: "pantry",
    })

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: otherProduct.id, action: "added" })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("PRODUCT_NOT_IN_STORE")
  })

  it("rejects invalid action", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "stolen" })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })
})

describe("GET /api/sessions/:id — get session detail", () => {
  it("returns session with items and transaction", async () => {
    const session = await Session.create({ store_id: store.id })

    // Add some items via API
    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    const res = await request(app).get(`/api/sessions/${session.id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(session.id)
    expect(res.body.data.SessionItems).toHaveLength(1)
  })

  it("returns 404 for non-existent session", async () => {
    const res = await request(app).get(`/api/sessions/${randomUUID()}`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("SESSION_NOT_FOUND")
  })
})

describe("POST /api/sessions/:id/close — close session", () => {
  it("closes with charge when cart has items", async () => {
    const session = await Session.create({ store_id: store.id })

    // Add 2 items
    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    const res = await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("charged")
    expect(res.body.data.Transaction).toBeDefined()
    expect(res.body.data.Transaction.total_cents).toBe(500) // 2 x 250
    expect(res.body.data.Transaction.status).toBe("succeeded")

    // Verify inventory was deducted
    const sp = await StoreProduct.findByPk(storeProduct.id)
    expect(sp?.quantity_on_hand).toBe(8) // 10 - 2
  })

  it("closes without charge for empty cart", async () => {
    const session = await Session.create({ store_id: store.id })

    const res = await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("closed")
  })

  it("closes without charge when items cancel out", async () => {
    const session = await Session.create({ store_id: store.id })

    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "removed" })

    const res = await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("closed")
  })

  it("rejects closing a session twice", async () => {
    const session = await Session.create({ store_id: store.id })

    // First close
    await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    // Second close
    const res = await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("SESSION_NOT_OPEN")
  })

  it("rejects close when insufficient stock", async () => {
    // Set stock to 1
    await StoreProduct.update(
      { quantity_on_hand: 1, version: 1 },
      { where: { id: storeProduct.id } },
    )

    const session = await Session.create({ store_id: store.id })

    // Add 3 items (more than available)
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/sessions/${session.id}/items`)
        .set(idemKey())
        .send({ product_id: product.id, action: "added" })
    }

    const res = await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK")
  })
})

describe("GET /api/sessions/:id/transaction — get transaction", () => {
  it("returns transaction for a charged session", async () => {
    const session = await Session.create({ store_id: store.id })

    await request(app)
      .post(`/api/sessions/${session.id}/items`)
      .set(idemKey())
      .send({ product_id: product.id, action: "added" })

    await request(app).post(`/api/sessions/${session.id}/close`).set(idemKey()).send()

    const res = await request(app).get(`/api/sessions/${session.id}/transaction`)

    expect(res.status).toBe(200)
    expect(res.body.data.session_id).toBe(session.id)
    expect(res.body.data.total_cents).toBe(250)
  })

  it("returns 404 for session with no transaction", async () => {
    const session = await Session.create({ store_id: store.id })

    const res = await request(app).get(`/api/sessions/${session.id}/transaction`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("TRANSACTION_NOT_FOUND")
  })

  it("returns 404 for non-existent session", async () => {
    const res = await request(app).get(`/api/sessions/${randomUUID()}/transaction`)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("SESSION_NOT_FOUND")
  })
})

import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import {
  Operator,
  Product,
  Session,
  SessionItem,
  Store,
  StoreProduct,
  Transaction,
  sequelize,
} from "../src/models/index.js"

const API_KEY = "txn-test-key"
const OTHER_API_KEY = "txn-other-key"

let storeId: string
let otherStoreId: string
let waterProductId: string
let chipsProductId: string
let transactionId: string
let otherTransactionId: string

async function createChargedSession(sid: string, productIds: string[]): Promise<string> {
  const session = await Session.create({
    store_id: sid,
    stripe_customer_id: null,
    stripe_payment_intent_id: null,
    idempotency_key: null,
    status: "charged",
    closed_at: new Date(),
    charged_at: new Date(),
  })

  for (const pid of productIds) {
    await SessionItem.create({
      session_id: session.id,
      product_id: pid,
      action: "added",
    })
  }

  const products = await Product.findAll({ where: { id: productIds } })
  const total = products.reduce((sum, p) => sum + p.price_cents, 0)

  const txn = await Transaction.create({
    session_id: session.id,
    store_id: sid,
    total_cents: total,
    stripe_charge_id: null,
    idempotency_key: null,
    status: "succeeded",
  })

  return txn.id
}

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Txn Test Op",
    email: "txn@example.com",
    api_key: API_KEY,
  })

  const otherOp = await Operator.create({
    name: "Other Op",
    email: "other@example.com",
    api_key: OTHER_API_KEY,
  })

  const store = await Store.create({
    operator_id: op.id,
    name: "Txn Store",
    location_name: null,
    address: null,
    status: "online",
  })
  storeId = store.id

  const otherStore = await Store.create({
    operator_id: otherOp.id,
    name: "Other Store",
    location_name: null,
    address: null,
    status: "online",
  })
  otherStoreId = otherStore.id

  const water = await Product.create({
    operator_id: op.id,
    name: "Water",
    sku: "TXN-WAT-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
  waterProductId = water.id

  const chips = await Product.create({
    operator_id: op.id,
    name: "Chips",
    sku: "TXN-CHP-001",
    price_cents: 249,
    image_url: null,
    category: "pantry",
  })
  chipsProductId = chips.id

  await StoreProduct.create({
    store_id: storeId,
    product_id: waterProductId,
    quantity_on_hand: 50,
    low_stock_threshold: 5,
  })
  await StoreProduct.create({
    store_id: storeId,
    product_id: chipsProductId,
    quantity_on_hand: 50,
    low_stock_threshold: 5,
  })

  // Create a transaction for the main operator
  transactionId = await createChargedSession(storeId, [waterProductId, chipsProductId])

  // Create a failed transaction for date filtering tests
  const failedSession = await Session.create({
    store_id: storeId,
    stripe_customer_id: null,
    stripe_payment_intent_id: null,
    idempotency_key: null,
    status: "failed",
    closed_at: new Date(),
  })
  await Transaction.create({
    session_id: failedSession.id,
    store_id: storeId,
    total_cents: 100,
    stripe_charge_id: null,
    idempotency_key: null,
    status: "failed",
  })

  // Create other operator's product + transaction
  const otherProduct = await Product.create({
    operator_id: otherOp.id,
    name: "Other Water",
    sku: "OTH-WAT-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
  await StoreProduct.create({
    store_id: otherStoreId,
    product_id: otherProduct.id,
    quantity_on_hand: 50,
    low_stock_threshold: 5,
  })
  otherTransactionId = await createChargedSession(otherStoreId, [otherProduct.id])
})

afterAll(async () => {
  await sequelize.close()
})

describe("Transactions API", () => {
  it("GET /api/transactions requires auth", async () => {
    const res = await request(app).get("/api/transactions")
    expect(res.status).toBe(401)
  })

  it("GET /api/transactions returns operator's transactions", async () => {
    const res = await request(app).get("/api/transactions").set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.length).toBe(2) // succeeded + failed
    expect(res.body.meta.pagination).toBeDefined()
    expect(res.body.meta.pagination.total).toBe(2)
  })

  it("GET /api/transactions does not return other operator's transactions", async () => {
    const res = await request(app).get("/api/transactions").set("x-api-key", API_KEY)

    const ids = res.body.data.map((t: { id: string }) => t.id)
    expect(ids).not.toContain(otherTransactionId)
  })

  it("GET /api/transactions filters by store_id", async () => {
    const res = await request(app)
      .get(`/api/transactions?store_id=${storeId}`)
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    for (const txn of res.body.data) {
      expect(txn.store_id).toBe(storeId)
    }
  })

  it("GET /api/transactions filters by status", async () => {
    const res = await request(app)
      .get("/api/transactions?status=succeeded")
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.data[0].status).toBe("succeeded")
  })

  it("GET /api/transactions filters by date range", async () => {
    const today = new Date().toISOString().split("T")[0]
    const res = await request(app)
      .get(`/api/transactions?start_date=${today}&end_date=${today}`)
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(2)
  })

  it("GET /api/transactions respects pagination", async () => {
    const res = await request(app).get("/api/transactions?page=1&limit=1").set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
    expect(res.body.meta.pagination.page).toBe(1)
    expect(res.body.meta.pagination.limit).toBe(1)
    expect(res.body.meta.pagination.total).toBe(2)
    expect(res.body.meta.pagination.total_pages).toBe(2)
  })

  it("GET /api/transactions caps limit at 100", async () => {
    const res = await request(app).get("/api/transactions?limit=999").set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.meta.pagination.limit).toBe(100)
  })

  it("GET /api/transactions/:id returns transaction detail", async () => {
    const res = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(transactionId)
    expect(res.body.data.store_name).toBe("Txn Store")
    expect(res.body.data.items).toBeDefined()
    expect(res.body.data.items.length).toBe(2)
    expect(res.body.data.session).toBeDefined()
    expect(res.body.data.session.status).toBe("charged")
  })

  it("GET /api/transactions/:id includes reconciled items with product info", async () => {
    const res = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set("x-api-key", API_KEY)

    const items = res.body.data.items
    for (const item of items) {
      expect(item.product_id).toBeDefined()
      expect(item.name).toBeDefined()
      expect(item.sku).toBeDefined()
      expect(item.price_cents).toBeGreaterThan(0)
      expect(item.quantity).toBeGreaterThan(0)
      expect(item.subtotal_cents).toBe(item.price_cents * item.quantity)
    }
  })

  it("GET /api/transactions/:id returns 404 for nonexistent", async () => {
    const res = await request(app)
      .get("/api/transactions/00000000-0000-0000-0000-000000000000")
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("TRANSACTION_NOT_FOUND")
  })

  it("GET /api/transactions/:id returns 404 for other operator's transaction", async () => {
    const res = await request(app)
      .get(`/api/transactions/${otherTransactionId}`)
      .set("x-api-key", API_KEY)

    expect(res.status).toBe(404)
  })

  it("GET /api/transactions/:id includes session dates", async () => {
    const res = await request(app)
      .get(`/api/transactions/${transactionId}`)
      .set("x-api-key", API_KEY)

    expect(res.body.data.session.opened_at).toBeDefined()
    expect(res.body.data.session.closed_at).toBeDefined()
    expect(res.body.data.session.charged_at).toBeDefined()
  })
})

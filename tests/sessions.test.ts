import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { Operator, Product, Store, StoreProduct, sequelize } from "../src/models/index.js"

let storeId: string
let offlineStoreId: string
let waterProductId: string
let chipsProductId: string
let juiceProductId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Session Test Op",
    email: "sessions@example.com",
    api_key: "session-test-key",
  })

  const store = await Store.create({
    operator_id: op.id,
    name: "Online Store",
    location_name: null,
    address: null,
    status: "online",
  })
  storeId = store.id

  const offlineStore = await Store.create({
    operator_id: op.id,
    name: "Offline Store",
    location_name: null,
    address: null,
    status: "offline",
  })
  offlineStoreId = offlineStore.id

  const water = await Product.create({
    operator_id: op.id,
    name: "Water",
    sku: "WAT-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
  waterProductId = water.id

  const chips = await Product.create({
    operator_id: op.id,
    name: "Chips",
    sku: "CHP-001",
    price_cents: 249,
    image_url: null,
    category: "pantry",
  })
  chipsProductId = chips.id

  const juice = await Product.create({
    operator_id: op.id,
    name: "Orange Juice",
    sku: "OJ-001",
    price_cents: 349,
    image_url: null,
    category: "fridge",
  })
  juiceProductId = juice.id

  for (const productId of [waterProductId, chipsProductId, juiceProductId]) {
    await StoreProduct.create({
      store_id: storeId,
      product_id: productId,
      quantity_on_hand: 10,
      low_stock_threshold: 3,
    })
  }
})

afterAll(async () => {
  await sequelize.close()
})

describe("Sessions API", () => {
  it("POST /api/sessions creates a session", async () => {
    const res = await request(app).post("/api/sessions").send({ store_id: storeId })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe("open")
    expect(res.body.data.store_id).toBe(storeId)
  })

  it("POST /api/sessions rejects missing store_id", async () => {
    const res = await request(app).post("/api/sessions").send({})
    expect(res.status).toBe(400)
  })

  it("POST /api/sessions rejects nonexistent store", async () => {
    const res = await request(app)
      .post("/api/sessions")
      .send({ store_id: "00000000-0000-0000-0000-000000000000" })
    expect(res.status).toBe(404)
  })

  it("POST /api/sessions rejects offline store", async () => {
    const res = await request(app).post("/api/sessions").send({ store_id: offlineStoreId })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("STORE_UNAVAILABLE")
  })

  it("POST /api/sessions/:id/items adds an item", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })
    const sessionId = session.body.data.id

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .send({ product_id: waterProductId, action: "added" })

    expect(res.status).toBe(201)
    expect(res.body.data.action).toBe("added")
  })

  it("POST /api/sessions/:id/items rejects invalid action", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })

    const res = await request(app)
      .post(`/api/sessions/${session.body.data.id}/items`)
      .send({ product_id: waterProductId, action: "invalid" })

    expect(res.status).toBe(400)
  })

  it("POST /api/sessions/:id/items rejects product not in store", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })

    const res = await request(app)
      .post(`/api/sessions/${session.body.data.id}/items`)
      .send({ product_id: "00000000-0000-0000-0000-000000000000", action: "added" })

    expect(res.status).toBe(404)
  })

  it("POST /api/sessions/:id/close handles empty cart", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })

    const res = await request(app).post(`/api/sessions/${session.body.data.id}/close`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("closed")
    expect(res.body.data.total_cents).toBe(0)
    expect(res.body.data.items).toEqual([])
  })

  it("POST /api/sessions/:id/close rejects already closed session", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })
    await request(app).post(`/api/sessions/${session.body.data.id}/close`)

    const res = await request(app).post(`/api/sessions/${session.body.data.id}/close`)
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("SESSION_NOT_OPEN")
  })

  it("POST /api/sessions/:id/items rejects if session not open", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })
    await request(app).post(`/api/sessions/${session.body.data.id}/close`)

    const res = await request(app)
      .post(`/api/sessions/${session.body.data.id}/items`)
      .send({ product_id: waterProductId, action: "added" })

    expect(res.status).toBe(422)
  })

  it("GET /api/sessions/:id returns session details", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })

    const res = await request(app).get(`/api/sessions/${session.body.data.id}`)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(session.body.data.id)
  })

  it("full flow: open → add items → remove → close → verify", async () => {
    const session = await request(app).post("/api/sessions").send({ store_id: storeId })
    const sid = session.body.data.id

    // Add water, chips, juice, then remove chips
    await request(app)
      .post(`/api/sessions/${sid}/items`)
      .send({ product_id: waterProductId, action: "added" })
    await request(app)
      .post(`/api/sessions/${sid}/items`)
      .send({ product_id: chipsProductId, action: "added" })
    await request(app)
      .post(`/api/sessions/${sid}/items`)
      .send({ product_id: juiceProductId, action: "added" })
    await request(app)
      .post(`/api/sessions/${sid}/items`)
      .send({ product_id: chipsProductId, action: "removed" })

    const closeRes = await request(app).post(`/api/sessions/${sid}/close`)

    expect(closeRes.status).toBe(200)
    expect(closeRes.body.data.status).toBe("charged")
    // Water (199) + OJ (349) = 548
    expect(closeRes.body.data.total_cents).toBe(548)
    expect(closeRes.body.data.items).toHaveLength(2)

    // Verify inventory was deducted
    const waterSp = await StoreProduct.findOne({
      where: { store_id: storeId, product_id: waterProductId },
    })
    const chipsSp = await StoreProduct.findOne({
      where: { store_id: storeId, product_id: chipsProductId },
    })
    // Water: 10 - 1 = 9, Chips: 10 (unchanged — was added then removed)
    expect(waterSp?.quantity_on_hand).toBe(9)
    expect(chipsSp?.quantity_on_hand).toBe(10)
  })
})

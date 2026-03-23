import { randomUUID } from "node:crypto"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { Operator, Product, sequelize } from "../src/models/index.js"

let apiKey: string
let otherApiKey: string
let productId: string
let storeId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const op = await Operator.create({
    name: "Test Op",
    email: "stores@example.com",
    api_key: "test-key-stores",
  })
  apiKey = op.api_key

  const otherOp = await Operator.create({
    name: "Other Op",
    email: "other@example.com",
    api_key: "other-key",
  })
  otherApiKey = otherOp.api_key

  const product = await Product.create({
    operator_id: op.id,
    name: "Water",
    sku: "WAT-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
  productId = product.id

  // Product belonging to the other operator
  await Product.create({
    operator_id: otherOp.id,
    name: "Other Water",
    sku: "OTH-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
})

afterAll(async () => {
  await sequelize.close()
})

describe("Stores API", () => {
  it("POST /api/stores creates a store", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ name: "Test Store", location_name: "Downtown", address: "123 Main St" })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe("Test Store")
    expect(res.body.data.status).toBe("offline")
    storeId = res.body.data.id
  })

  it("POST /api/stores rejects missing name", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("POST /api/stores rejects missing API key", async () => {
    const res = await request(app).post("/api/stores").send({ name: "No Key" })

    expect(res.status).toBe(401)
  })

  it("POST /api/stores rejects invalid API key", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", "bad-key")
      .set("idempotency-key", randomUUID())
      .send({ name: "Bad Key" })

    expect(res.status).toBe(401)
  })

  it("GET /api/stores returns operator stores only", async () => {
    // Create a store for the other operator
    await request(app)
      .post("/api/stores")
      .set("x-api-key", otherApiKey)
      .set("idempotency-key", randomUUID())
      .send({ name: "Other Store" })

    const res = await request(app).get("/api/stores").set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe("Test Store")
  })

  it("GET /api/stores/:id returns store with products", async () => {
    const res = await request(app).get(`/api/stores/${storeId}`).set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(storeId)
    expect(res.body.data.StoreProducts).toBeDefined()
  })

  it("GET /api/stores/:id returns 404 for nonexistent store", async () => {
    const res = await request(app)
      .get("/api/stores/00000000-0000-0000-0000-000000000000")
      .set("x-api-key", apiKey)

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("STORE_NOT_FOUND")
  })

  it("GET /api/stores/:id returns 404 for another operators store", async () => {
    const other = await request(app)
      .post("/api/stores")
      .set("x-api-key", otherApiKey)
      .set("idempotency-key", randomUUID())
      .send({ name: "Secret Store" })

    const res = await request(app).get(`/api/stores/${other.body.data.id}`).set("x-api-key", apiKey)

    expect(res.status).toBe(404)
  })

  it("POST /api/stores/:id/products adds product to store", async () => {
    const res = await request(app)
      .post(`/api/stores/${storeId}/products`)
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ product_id: productId, quantity_on_hand: 10, low_stock_threshold: 3 })

    expect(res.status).toBe(201)
    expect(res.body.data.quantity_on_hand).toBe(10)
    expect(res.body.data.low_stock_threshold).toBe(3)
  })

  it("POST /api/stores/:id/products rejects duplicate", async () => {
    const res = await request(app)
      .post(`/api/stores/${storeId}/products`)
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ product_id: productId })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("PRODUCT_ALREADY_IN_STORE")
  })

  it("POST /api/stores/:id/products rejects product from different operator", async () => {
    const otherProducts = await request(app).get("/api/products").set("x-api-key", otherApiKey)

    const otherProductId = otherProducts.body.data[0].id

    const res = await request(app)
      .post(`/api/stores/${storeId}/products`)
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ product_id: otherProductId })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND")
  })

  it("PATCH /api/stores/:id/products/:productId updates quantity", async () => {
    const res = await request(app)
      .patch(`/api/stores/${storeId}/products/${productId}`)
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ quantity_on_hand: 25 })

    expect(res.status).toBe(200)
    expect(res.body.data.quantity_on_hand).toBe(25)
  })

  it("PATCH /api/stores/:id/products/:productId returns 404 for missing", async () => {
    const res = await request(app)
      .patch(`/api/stores/${storeId}/products/00000000-0000-0000-0000-000000000000`)
      .set("x-api-key", apiKey)
      .set("idempotency-key", randomUUID())
      .send({ quantity_on_hand: 5 })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("STORE_PRODUCT_NOT_FOUND")
  })
})

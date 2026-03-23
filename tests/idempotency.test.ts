import { randomUUID } from "node:crypto"
import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { IdempotencyKey, Operator, sequelize } from "../src/models/index.js"

let apiKey: string

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const op = await Operator.create({
    name: "Idempotency Op",
    email: "idempotency@example.com",
    api_key: "test-key-idempotency",
  })
  apiKey = op.api_key
})

afterAll(async () => {
  await sequelize.close()
})

describe("Idempotency Middleware", () => {
  it("rejects POST without Idempotency-Key header", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .send({ name: "No Key Store" })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("MISSING_IDEMPOTENCY_KEY")
  })

  it("rejects PATCH without Idempotency-Key header", async () => {
    const res = await request(app)
      .patch("/api/stores/fake-id/products/fake-id")
      .set("x-api-key", apiKey)
      .send({ quantity_on_hand: 5 })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("MISSING_IDEMPOTENCY_KEY")
  })

  it("allows GET without Idempotency-Key header", async () => {
    const res = await request(app).get("/api/stores").set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it("rejects key longer than 255 characters", async () => {
    const longKey = "a".repeat(256)
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", longKey)
      .send({ name: "Long Key Store" })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("INVALID_IDEMPOTENCY_KEY")
  })

  it("executes first request normally", async () => {
    const key = randomUUID()
    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "First Request Store" })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe("First Request Store")
  })

  it("replays cached response on duplicate request", async () => {
    const key = randomUUID()
    const body = { name: "Replay Store" }

    const first = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send(body)

    expect(first.status).toBe(201)

    // Small delay to ensure the async cache write completes
    await new Promise((resolve) => setTimeout(resolve, 50))

    const second = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send(body)

    expect(second.status).toBe(201)
    expect(second.body.data.id).toBe(first.body.data.id)
    expect(second.body.data.name).toBe("Replay Store")
  })

  it("returns 422 on body mismatch", async () => {
    const key = randomUUID()

    await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Original Body" })

    await new Promise((resolve) => setTimeout(resolve, 50))

    const res = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Different Body" })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("IDEMPOTENCY_BODY_MISMATCH")
  })

  it("returns 422 on path mismatch", async () => {
    const key = randomUUID()

    await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Path Mismatch Store" })

    await new Promise((resolve) => setTimeout(resolve, 50))

    const res = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Path Mismatch Store" })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe("IDEMPOTENCY_PATH_MISMATCH")
  })

  it("treats expired key as new request", async () => {
    const key = randomUUID()

    const first = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Expired Key Store" })

    expect(first.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Manually expire the key
    await IdempotencyKey.update({ expires_at: new Date(Date.now() - 1000) }, { where: { key } })

    const second = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Expired Key Store" })

    // New request executes — creates a second store with the same name
    expect(second.status).toBe(201)
    expect(second.body.data.id).not.toBe(first.body.data.id)
  })

  it("caches and replays 4xx error responses", async () => {
    const key = randomUUID()

    const first = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "No SKU" })

    expect(first.status).toBe(400)
    expect(first.body.error.code).toBe("VALIDATION_ERROR")

    await new Promise((resolve) => setTimeout(resolve, 50))

    const second = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "No SKU" })

    expect(second.status).toBe(400)
    expect(second.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("produces same hash regardless of body key ordering", async () => {
    const key = randomUUID()

    const first = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ name: "Order Test", location_name: "Here", address: "123 St" })

    expect(first.status).toBe(201)

    await new Promise((resolve) => setTimeout(resolve, 50))

    // Same data, different key order — should match the hash
    const second = await request(app)
      .post("/api/stores")
      .set("x-api-key", apiKey)
      .set("idempotency-key", key)
      .send({ address: "123 St", name: "Order Test", location_name: "Here" })

    expect(second.status).toBe(201)
    expect(second.body.data.id).toBe(first.body.data.id)
  })
})

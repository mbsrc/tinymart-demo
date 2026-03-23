import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { Operator, sequelize } from "../src/models/index.js"

let apiKey: string

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const op = await Operator.create({
    name: "Test Op",
    email: "test@example.com",
    api_key: "test-key-products",
  })
  apiKey = op.api_key
})

afterAll(async () => {
  await sequelize.close()
})

describe("Products API", () => {
  it("POST /api/products creates a product", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .send({ name: "Water", sku: "WAT-001", price_cents: 199, category: "fridge" })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe("Water")
    expect(res.body.data.sku).toBe("WAT-001")
  })

  it("POST /api/products rejects duplicate SKU", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .send({ name: "Water Dupe", sku: "WAT-001", price_cents: 100, category: "fridge" })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("DUPLICATE_SKU")
  })

  it("POST /api/products rejects missing fields", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .send({ name: "No SKU" })

    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("VALIDATION_ERROR")
  })

  it("POST /api/products rejects invalid category", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .send({ name: "Bad", sku: "BAD-001", price_cents: 100, category: "invalid" })

    expect(res.status).toBe(400)
  })

  it("GET /api/products returns operator products", async () => {
    const res = await request(app).get("/api/products").set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].sku).toBe("WAT-001")
  })

  it("GET /api/products?category=fridge filters by category", async () => {
    await request(app)
      .post("/api/products")
      .set("x-api-key", apiKey)
      .send({ name: "Chips", sku: "CHP-001", price_cents: 249, category: "pantry" })

    const res = await request(app).get("/api/products?category=fridge").set("x-api-key", apiKey)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].category).toBe("fridge")
  })
})

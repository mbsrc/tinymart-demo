import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { app, createOperator, idemKey, request, sequelize } from "./helpers.js"

vi.mock("../../src/services/deferredCharge.js", () => ({
  captureOrDefer: vi.fn().mockResolvedValue({
    outcome: "captured",
  }),
}))

vi.mock("../../src/services/stripe.js", () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({ id: "pi_test_e2e_123" }),
  cancelPaymentIntent: vi.fn().mockResolvedValue({}),
  capturePaymentIntent: vi.fn().mockResolvedValue({}),
  stripeCircuitBreaker: { getState: () => "closed", getStatus: () => ({}) },
}))

let headers: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctx = await createOperator("Shopping Flow Op")
  headers = ctx.headers
})

afterAll(async () => {
  await sequelize.close()
})

describe("E2E shopping flow", () => {
  let storeId: string
  let productAId: string
  let productBId: string
  let sessionId: string

  it("creates a store and sets it online", async () => {
    const res = await request(app)
      .post("/api/stores")
      .set({ ...headers, ...idemKey() })
      .send({ name: "Corner Fridge", location_name: "Lobby" })

    expect(res.status).toBe(201)
    storeId = res.body.data.id

    // Set store online
    const store = await (await import("../../src/models/index.js")).Store.findByPk(storeId)
    await store?.update({ status: "online" })
  })

  it("creates two products", async () => {
    const resA = await request(app)
      .post("/api/products")
      .set({ ...headers, ...idemKey() })
      .send({ name: "Cola", sku: "COLA-001", price_cents: 250, category: "fridge" })

    expect(resA.status).toBe(201)
    productAId = resA.body.data.id

    const resB = await request(app)
      .post("/api/products")
      .set({ ...headers, ...idemKey() })
      .send({ name: "Chips", sku: "CHIP-001", price_cents: 350, category: "pantry" })

    expect(resB.status).toBe(201)
    productBId = resB.body.data.id
  })

  it("adds products to store and restocks", async () => {
    // Add product A
    const resA = await request(app)
      .post(`/api/stores/${storeId}/products`)
      .set({ ...headers, ...idemKey() })
      .send({ product_id: productAId })

    expect(resA.status).toBe(201)

    // Add product B
    const resB = await request(app)
      .post(`/api/stores/${storeId}/products`)
      .set({ ...headers, ...idemKey() })
      .send({ product_id: productBId })

    expect(resB.status).toBe(201)

    // Restock both to 10 units
    await request(app)
      .patch(`/api/stores/${storeId}/products/${productAId}`)
      .set({ ...headers, ...idemKey() })
      .send({ quantity_on_hand: 10 })

    await request(app)
      .patch(`/api/stores/${storeId}/products/${productBId}`)
      .set({ ...headers, ...idemKey() })
      .send({ quantity_on_hand: 10 })
  })

  it("opens a shopping session", async () => {
    const res = await request(app).post("/api/sessions").set(idemKey()).send({ store_id: storeId })

    expect(res.status).toBe(201)
    expect(res.body.data.status).toBe("open")
    sessionId = res.body.data.id
  })

  it("adds items to the session", async () => {
    // Grab 2 Colas
    for (let i = 0; i < 2; i++) {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/items`)
        .set(idemKey())
        .send({ product_id: productAId, action: "added" })

      expect(res.status).toBe(201)
    }

    // Grab 1 Chips
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: productBId, action: "added" })

    expect(res.status).toBe(201)

    // Put 1 Cola back
    const removeRes = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: productAId, action: "removed" })

    expect(removeRes.status).toBe(201)
  })

  it("shows items in session detail", async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}`)

    expect(res.status).toBe(200)
    expect(res.body.data.SessionItems).toHaveLength(4) // 2 added + 1 added + 1 removed
  })

  it("closes the session with charge", async () => {
    const res = await request(app).post(`/api/sessions/${sessionId}/close`).set(idemKey()).send()

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("charged")
    expect(res.body.data.Transaction).toBeDefined()

    // Net cart: 1 Cola (250) + 1 Chips (350) = 600
    expect(res.body.data.Transaction.total_cents).toBe(600)
    expect(res.body.data.Transaction.status).toBe("succeeded")
  })

  it("verifies inventory was deducted", async () => {
    const storeRes = await request(app).get(`/api/stores/${storeId}`).set(headers)

    expect(storeRes.status).toBe(200)

    const products = storeRes.body.data.StoreProducts
    const colaStock = products.find((p: { product_id: string }) => p.product_id === productAId)
    const chipsStock = products.find((p: { product_id: string }) => p.product_id === productBId)

    expect(colaStock.quantity_on_hand).toBe(9) // 10 - 1
    expect(chipsStock.quantity_on_hand).toBe(9) // 10 - 1
  })

  it("verifies inventory events were created", async () => {
    // Check Cola events
    const colaRes = await request(app)
      .get(`/api/stores/${storeId}/products/${productAId}/events`)
      .set(headers)

    expect(colaRes.status).toBe(200)
    const colaEvents = colaRes.body.data.events
    // restock + deduct = 2 events
    expect(colaEvents).toHaveLength(2)
    expect(colaEvents.some((e: { event_type: string }) => e.event_type === "restock")).toBe(true)
    expect(colaEvents.some((e: { event_type: string }) => e.event_type === "deduct")).toBe(true)
  })

  it("verifies transaction endpoint returns data", async () => {
    const res = await request(app).get(`/api/sessions/${sessionId}/transaction`)

    expect(res.status).toBe(200)
    expect(res.body.data.total_cents).toBe(600)
    expect(res.body.data.session_id).toBe(sessionId)
  })

  it("prevents re-closing the session", async () => {
    const res = await request(app).post(`/api/sessions/${sessionId}/close`).set(idemKey()).send()

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("SESSION_NOT_OPEN")
  })

  it("prevents adding items to a closed session", async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/items`)
      .set(idemKey())
      .send({ product_id: productAId, action: "added" })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe("SESSION_NOT_OPEN")
  })
})

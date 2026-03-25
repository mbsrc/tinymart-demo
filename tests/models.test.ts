import { afterAll, beforeAll, describe, expect, it } from "vitest"
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

beforeAll(async () => {
  await sequelize.sync({ force: true })
})

afterAll(async () => {
  await sequelize.close()
})

describe("Models", () => {
  let operatorId: string
  let storeId: string
  let productId: string
  let sessionId: string

  it("creates an Operator", async () => {
    const op = await Operator.create({
      name: "Test Operator",
      email: "test@example.com",
      api_key: "test-api-key-123",
    })
    operatorId = op.id
    expect(op.id).toBeDefined()
    expect(op.name).toBe("Test Operator")
  })

  it("creates a Store belonging to Operator", async () => {
    const store = await Store.create({
      operator_id: operatorId,
      name: "Test Store",
      location_name: "Test Location",
      address: "123 Test St",
    })
    storeId = store.id
    expect(store.status).toBe("offline")
    expect(store.operator_id).toBe(operatorId)
  })

  it("creates a Product belonging to Operator", async () => {
    const product = await Product.create({
      operator_id: operatorId,
      name: "Test Water",
      sku: "TST-001",
      price_cents: 199,
      image_url: null,
      category: "fridge",
    })
    productId = product.id
    expect(product.sku).toBe("TST-001")
  })

  it("creates a StoreProduct linking Store and Product", async () => {
    const sp = await StoreProduct.create({
      store_id: storeId,
      product_id: productId,
    })
    expect(sp.quantity_on_hand).toBe(0)
    expect(sp.low_stock_threshold).toBe(5)
  })

  it("rejects duplicate StoreProduct (unique composite)", async () => {
    await expect(
      StoreProduct.create({
        store_id: storeId,
        product_id: productId,
      }),
    ).rejects.toThrow()
  })

  it("rejects duplicate Product SKU", async () => {
    await expect(
      Product.create({
        operator_id: operatorId,
        name: "Duplicate SKU",
        sku: "TST-001",
        price_cents: 100,
        image_url: null,
        category: "pantry",
      }),
    ).rejects.toThrow()
  })

  it("rejects duplicate Operator email", async () => {
    await expect(
      Operator.create({
        name: "Duplicate",
        email: "test@example.com",
        api_key: "different-key",
      }),
    ).rejects.toThrow()
  })

  it("creates a Session", async () => {
    const session = await Session.create({
      store_id: storeId,
      stripe_payment_method_id: null,
      stripe_payment_intent_id: null,
      idempotency_key: null,
    })
    sessionId = session.id
    expect(session.status).toBe("open")
    expect(session.opened_at).toBeDefined()
  })

  it("creates SessionItems", async () => {
    const item = await SessionItem.create({
      session_id: sessionId,
      product_id: productId,
      action: "added",
    })
    expect(item.timestamp).toBeDefined()
  })

  it("creates a Transaction", async () => {
    const txn = await Transaction.create({
      session_id: sessionId,
      store_id: storeId,
      total_cents: 199,
      stripe_charge_id: null,
      idempotency_key: null,
    })
    expect(txn.status).toBe("pending")
  })

  it("loads associations (Store → Operator, StoreProducts)", async () => {
    const store = await Store.findByPk(storeId, {
      include: [Operator, StoreProduct],
    })
    expect(store?.Operator?.name).toBe("Test Operator")
    expect(store?.StoreProducts).toHaveLength(1)
  })

  it("loads Session → SessionItems + Transaction", async () => {
    const session = await Session.findByPk(sessionId, {
      include: [SessionItem, Transaction],
    })
    expect(session?.SessionItems).toHaveLength(1)
    expect(session?.Transaction?.total_cents).toBe(199)
  })
})

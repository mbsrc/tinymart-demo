import type { Job } from "pg-boss"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { handleDeductInventory } from "../src/jobs/handlers/deductInventory.js"
import type { DeductInventoryPayload } from "../src/jobs/handlers/deductInventory.js"
import { InventoryEvent } from "../src/models/InventoryEvent.js"
import {
  Operator,
  Product,
  Session,
  SessionItem,
  Store,
  StoreProduct,
  sequelize,
} from "../src/models/index.js"

let storeId: string
let sessionId: string
let productAId: string
let productBId: string
let storeProductAId: string
let storeProductBId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Deduct Test Op",
    email: "deduct@example.com",
    api_key: "test-key-deduct",
  })

  const store = await Store.create({
    operator_id: op.id,
    name: "Deduct Test Store",
  })
  storeId = store.id

  const productA = await Product.create({
    operator_id: op.id,
    name: "Water",
    sku: "DED-001",
    price_cents: 199,
    image_url: null,
    category: "fridge",
  })
  productAId = productA.id

  const productB = await Product.create({
    operator_id: op.id,
    name: "Cola",
    sku: "DED-002",
    price_cents: 250,
    image_url: null,
    category: "fridge",
  })
  productBId = productB.id

  const spA = await StoreProduct.create({
    store_id: store.id,
    product_id: productAId,
    quantity_on_hand: 10,
  })
  storeProductAId = spA.id

  const spB = await StoreProduct.create({
    store_id: store.id,
    product_id: productBId,
    quantity_on_hand: 8,
  })
  storeProductBId = spB.id

  // Session: 2 water added, 1 water removed, 1 cola added → net: water=1, cola=1
  const session = await Session.create({
    store_id: storeId,
    stripe_customer_id: "cus_deduct",
    stripe_payment_intent_id: "pi_deduct",
  })
  sessionId = session.id

  await SessionItem.create({ session_id: sessionId, product_id: productAId, action: "added" })
  await SessionItem.create({ session_id: sessionId, product_id: productAId, action: "added" })
  await SessionItem.create({ session_id: sessionId, product_id: productAId, action: "removed" })
  await SessionItem.create({ session_id: sessionId, product_id: productBId, action: "added" })
})

afterAll(async () => {
  await sequelize.close()
})

function makeJob<T>(data: T): Job<T>[] {
  return [
    {
      id: "test-deduct-job",
      name: "deduct-inventory",
      data,
      expireInSeconds: 3600,
      heartbeatSeconds: null,
      signal: new AbortController().signal,
    },
  ]
}

describe("deduct-inventory handler", () => {
  it("deducts inventory for session items", async () => {
    await handleDeductInventory(makeJob<DeductInventoryPayload>({ sessionId }))

    const spA = await StoreProduct.findByPk(storeProductAId)
    const spB = await StoreProduct.findByPk(storeProductBId)

    // Water: 10 - 1 (net) = 9
    expect(spA?.quantity_on_hand).toBe(9)
    // Cola: 8 - 1 (net) = 7
    expect(spB?.quantity_on_hand).toBe(7)

    const events = await InventoryEvent.findAll({
      where: { reference_id: sessionId, event_type: "deduct" },
    })
    expect(events).toHaveLength(2)
  })

  it("is idempotent: skips if already deducted", async () => {
    // Run again — should not change anything
    await handleDeductInventory(makeJob<DeductInventoryPayload>({ sessionId }))

    const spA = await StoreProduct.findByPk(storeProductAId)
    const spB = await StoreProduct.findByPk(storeProductBId)

    expect(spA?.quantity_on_hand).toBe(9)
    expect(spB?.quantity_on_hand).toBe(7)

    const events = await InventoryEvent.findAll({
      where: { reference_id: sessionId, event_type: "deduct" },
    })
    expect(events).toHaveLength(2)
  })

  it("skips if session not found", async () => {
    // Should not throw
    await handleDeductInventory(
      makeJob<DeductInventoryPayload>({
        sessionId: "00000000-0000-0000-0000-000000000000",
      }),
    )
  })

  it("handles multiple products in one session", async () => {
    // Verified above: both water and cola were deducted in a single job run
    const events = await InventoryEvent.findAll({
      where: { reference_id: sessionId, event_type: "deduct" },
    })

    const productIds = events.map((e) => e.store_product_id).sort()
    expect(productIds).toEqual([storeProductAId, storeProductBId].sort())
  })
})

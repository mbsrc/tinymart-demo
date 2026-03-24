import { QueryTypes } from "sequelize"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { InventoryEvent } from "../src/models/InventoryEvent.js"
import { Operator, Product, Store, StoreProduct, sequelize } from "../src/models/index.js"
import { adjustInventory, getEventHistory } from "../src/services/inventory.js"
import { AppError } from "../src/types/index.js"

let storeProductId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Inventory Test Op",
    email: "inventory@example.com",
    api_key: "test-key-inventory",
  })

  const store = await Store.create({
    operator_id: op.id,
    name: "Inventory Test Store",
  })

  const product = await Product.create({
    operator_id: op.id,
    name: "Test Item",
    sku: "INV-001",
    price_cents: 500,
    image_url: null,
    category: "fridge",
  })

  const sp = await StoreProduct.create({
    store_id: store.id,
    product_id: product.id,
    quantity_on_hand: 20,
    low_stock_threshold: 3,
  })
  storeProductId = sp.id
})

afterAll(async () => {
  await sequelize.close()
})

describe("adjustInventory", () => {
  it("restock increases quantity and creates event", async () => {
    const event = await adjustInventory({
      storeProductId,
      eventType: "restock",
      quantity: 5,
    })

    expect(event.event_type).toBe("restock")
    expect(event.quantity).toBe(5)
    expect(event.version).toBe(1)

    const sp = await StoreProduct.findByPk(storeProductId)
    expect(sp?.quantity_on_hand).toBe(25)
    expect(sp?.version).toBe(1)
  })

  it("deduct decreases quantity", async () => {
    const event = await adjustInventory({
      storeProductId,
      eventType: "deduct",
      quantity: 3,
    })

    expect(event.event_type).toBe("deduct")
    expect(event.quantity).toBe(-3)
    expect(event.version).toBe(2)

    const sp = await StoreProduct.findByPk(storeProductId)
    expect(sp?.quantity_on_hand).toBe(22)
  })

  it("stores reference fields on events", async () => {
    const event = await adjustInventory({
      storeProductId,
      eventType: "reserve",
      quantity: 1,
      referenceId: "00000000-0000-0000-0000-000000000001",
      referenceType: "session",
      metadata: { note: "test" },
    })

    expect(event.reference_id).toBe("00000000-0000-0000-0000-000000000001")
    expect(event.reference_type).toBe("session")
    expect(event.metadata).toEqual({ note: "test" })
    expect(event.version).toBe(3)
  })

  it("creates sequential event versions", async () => {
    const events = await InventoryEvent.findAll({
      where: { store_product_id: storeProductId },
      order: [["version", "ASC"]],
    })

    const versions = events.map((e) => e.version)
    expect(versions).toEqual([1, 2, 3])
  })

  it("throws INSUFFICIENT_STOCK when not enough inventory", async () => {
    await expect(
      adjustInventory({
        storeProductId,
        eventType: "deduct",
        quantity: 999,
      }),
    ).rejects.toThrow(AppError)

    await expect(
      adjustInventory({
        storeProductId,
        eventType: "deduct",
        quantity: 999,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", statusCode: 409 })
  })

  it("optimistic lock rejects stale version writes", async () => {
    const sp = await StoreProduct.findByPk(storeProductId)
    if (!sp) throw new Error("StoreProduct not found")
    const staleVersion = sp.version

    // Another process completes a write, bumping the version
    await adjustInventory({ storeProductId, eventType: "restock", quantity: 1 })

    // A stale write using the old version gets 0 rows — the core of optimistic locking
    const [, rowCount] = await sequelize.query(
      `UPDATE store_products
       SET quantity_on_hand = quantity_on_hand + 1, version = version + 1, updated_at = NOW()
       WHERE id = :id AND version = :staleVersion`,
      {
        replacements: { id: storeProductId, staleVersion },
        type: QueryTypes.UPDATE,
      },
    )
    expect(rowCount).toBe(0)
  })

  it("rejects zero or negative quantity", async () => {
    await expect(
      adjustInventory({
        storeProductId,
        eventType: "restock",
        quantity: 0,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" })
  })
})

describe("getEventHistory", () => {
  it("returns paginated results with total", async () => {
    const { events, total } = await getEventHistory(storeProductId, { limit: 2, offset: 0 })

    expect(events.length).toBeLessThanOrEqual(2)
    expect(total).toBeGreaterThanOrEqual(2)
    // Should be in descending version order
    if (events.length >= 2) {
      expect(events[0].version).toBeGreaterThan(events[1].version)
    }
  })

  it("respects offset", async () => {
    const all = await getEventHistory(storeProductId)
    const offset = await getEventHistory(storeProductId, { offset: 1 })

    expect(offset.total).toBe(all.total)
    expect(offset.events.length).toBe(all.events.length - 1)
  })
})

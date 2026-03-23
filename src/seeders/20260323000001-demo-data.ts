import type { QueryInterface } from "sequelize"
import { v4 as uuid } from "uuid"

const operatorId = uuid()
const store1Id = uuid()
const store2Id = uuid()
const sessionId = uuid()

const productIds = Array.from({ length: 10 }, () => uuid())
const waterProductId = productIds[0] as string
const colaProductId = productIds[1] as string
const energyBarProductId = productIds[4] as string

const products = [
  { name: "Bottled Water", sku: "WAT-001", price_cents: 199, category: "fridge" },
  { name: "Cola", sku: "COL-001", price_cents: 249, category: "fridge" },
  { name: "Orange Juice", sku: "OJ-001", price_cents: 349, category: "fridge" },
  { name: "Greek Yogurt", sku: "YOG-001", price_cents: 299, category: "fridge" },
  { name: "Energy Bar", sku: "BAR-001", price_cents: 199, category: "pantry" },
  { name: "Trail Mix", sku: "MIX-001", price_cents: 399, category: "pantry" },
  { name: "Chips", sku: "CHP-001", price_cents: 249, category: "pantry" },
  { name: "Ice Cream Bar", sku: "ICE-001", price_cents: 349, category: "freezer" },
  { name: "Frozen Burrito", sku: "BUR-001", price_cents: 449, category: "freezer" },
  { name: "Sandwich", sku: "SAN-001", price_cents: 549, category: "fridge" },
] as const

const quantities = [15, 20, 12, 8, 18, 10, 14, 6, 9, 11]
const thresholds = [3, 5, 3, 3, 5, 3, 5, 3, 3, 5]

const now = new Date()

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.bulkInsert("operators", [
      {
        id: operatorId,
        name: "TinyMart Demo",
        email: "demo@tinymart.dev",
        api_key: uuid(),
        created_at: now,
        updated_at: now,
      },
    ])

    await queryInterface.bulkInsert("stores", [
      {
        id: store1Id,
        operator_id: operatorId,
        name: "Downtown Fridge",
        location_name: "Urban convenience",
        address: "123 Main St",
        status: "online",
        created_at: now,
        updated_at: now,
      },
      {
        id: store2Id,
        operator_id: operatorId,
        name: "Campus Market",
        location_name: "University location",
        address: "456 College Ave",
        status: "online",
        created_at: now,
        updated_at: now,
      },
    ])

    await queryInterface.bulkInsert(
      "products",
      products.map((p, i) => ({
        id: productIds[i],
        operator_id: operatorId,
        name: p.name,
        sku: p.sku,
        price_cents: p.price_cents,
        image_url: null,
        category: p.category,
        created_at: now,
        updated_at: now,
      })),
    )

    const storeProducts = [store1Id, store2Id].flatMap((storeId) =>
      productIds.map((productId, i) => ({
        id: uuid(),
        store_id: storeId,
        product_id: productId,
        quantity_on_hand: quantities[i],
        low_stock_threshold: thresholds[i],
        created_at: now,
        updated_at: now,
      })),
    )
    await queryInterface.bulkInsert("store_products", storeProducts)

    // Sample completed session at Downtown Fridge
    const openedAt = new Date(now.getTime() - 10 * 60_000)
    const closedAt = new Date(now.getTime() - 5 * 60_000)
    const chargedAt = new Date(now.getTime() - 4 * 60_000)

    await queryInterface.bulkInsert("sessions", [
      {
        id: sessionId,
        store_id: store1Id,
        stripe_customer_id: "cus_demo_123",
        stripe_payment_intent_id: "pi_demo_123",
        idempotency_key: uuid(),
        status: "charged",
        opened_at: openedAt,
        closed_at: closedAt,
        charged_at: chargedAt,
        created_at: openedAt,
        updated_at: chargedAt,
      },
    ])

    // 3 items added, 1 removed (Cola added then removed)
    await queryInterface.bulkInsert("session_items", [
      {
        id: uuid(),
        session_id: sessionId,
        product_id: waterProductId, // Bottled Water — added
        action: "added",
        timestamp: new Date(openedAt.getTime() + 30_000),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuid(),
        session_id: sessionId,
        product_id: colaProductId, // Cola — added
        action: "added",
        timestamp: new Date(openedAt.getTime() + 60_000),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuid(),
        session_id: sessionId,
        product_id: colaProductId, // Cola — removed
        action: "removed",
        timestamp: new Date(openedAt.getTime() + 90_000),
        created_at: now,
        updated_at: now,
      },
      {
        id: uuid(),
        session_id: sessionId,
        product_id: energyBarProductId, // Energy Bar — added
        action: "added",
        timestamp: new Date(openedAt.getTime() + 120_000),
        created_at: now,
        updated_at: now,
      },
    ])

    // Net: Bottled Water (199) + Energy Bar (199) = 398 cents
    await queryInterface.bulkInsert("transactions", [
      {
        id: uuid(),
        session_id: sessionId,
        store_id: store1Id,
        total_cents: 398,
        stripe_charge_id: "ch_demo_123",
        idempotency_key: uuid(),
        status: "succeeded",
        created_at: chargedAt,
        updated_at: chargedAt,
      },
    ])
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.bulkDelete("transactions", {})
    await queryInterface.bulkDelete("session_items", {})
    await queryInterface.bulkDelete("sessions", {})
    await queryInterface.bulkDelete("store_products", {})
    await queryInterface.bulkDelete("products", {})
    await queryInterface.bulkDelete("stores", {})
    await queryInterface.bulkDelete("operators", {})
  },
}

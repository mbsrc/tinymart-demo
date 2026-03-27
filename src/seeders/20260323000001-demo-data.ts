import type { QueryInterface } from "sequelize"
import { v4 as uuid } from "uuid"

const operatorId = uuid()
const store1Id = uuid()
const store2Id = uuid()

const productIds = Array.from({ length: 10 }, () => uuid())

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

const quantities = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
const thresholds = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5]

const now = new Date()

export default {
  async up(queryInterface: QueryInterface) {
    // Idempotency: skip if the demo operator already exists
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM operators WHERE email = 'demo@tinymart.dev' LIMIT 1",
    )
    if ((existing as unknown[]).length > 0) return

    await queryInterface.bulkInsert("operators", [
      {
        id: operatorId,
        name: "TinyMart Demo",
        email: "demo@tinymart.dev",
        api_key: "tinymart-demo-key-2026",
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
        version: 0,
        created_at: now,
        updated_at: now,
      })),
    )
    await queryInterface.bulkInsert("store_products", storeProducts)
  },

  async down(queryInterface: QueryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM operators WHERE email = 'demo@tinymart.dev' LIMIT 1",
    )
    const operators = rows as { id: string }[]
    const firstOperator = operators[0]
    if (!firstOperator) return
    const opId = firstOperator.id

    // Delete in reverse dependency order, scoped to the demo operator
    await queryInterface.sequelize.query(
      `DELETE FROM store_products WHERE store_id IN (SELECT id FROM stores WHERE operator_id = '${opId}')`,
    )
    await queryInterface.sequelize.query(`DELETE FROM products WHERE operator_id = '${opId}'`)
    await queryInterface.sequelize.query(`DELETE FROM stores WHERE operator_id = '${opId}'`)
    await queryInterface.sequelize.query(`DELETE FROM operators WHERE id = '${opId}'`)
  },
}

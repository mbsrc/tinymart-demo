import { QueryTypes } from "sequelize"
import { InventoryEvent } from "../models/InventoryEvent.js"
import type { InventoryEventType } from "../models/InventoryEvent.js"
import { StoreProduct } from "../models/StoreProduct.js"
import { sequelize } from "../models/index.js"
import { AppError } from "../types/index.js"

interface AdjustInventoryParams {
  storeProductId: string
  eventType: InventoryEventType
  quantity: number
  referenceId?: string
  referenceType?: string
  metadata?: Record<string, unknown>
}

interface EventHistoryOptions {
  limit?: number
  offset?: number
}

const ADDITIVE_TYPES: Set<InventoryEventType> = new Set(["restock", "release"])
const SUBTRACTIVE_TYPES: Set<InventoryEventType> = new Set(["reserve", "deduct"])

function computeDelta(eventType: InventoryEventType, quantity: number): number {
  if (ADDITIVE_TYPES.has(eventType)) return quantity
  if (SUBTRACTIVE_TYPES.has(eventType)) return -quantity
  // adjustment: caller's quantity is the absolute value, positive means add
  return quantity
}

async function adjustInventory(params: AdjustInventoryParams): Promise<InventoryEvent> {
  const { storeProductId, eventType, quantity, referenceId, referenceType, metadata } = params

  if (quantity <= 0) {
    throw new AppError(400, "VALIDATION_ERROR", "quantity must be a positive integer")
  }

  return sequelize.transaction(async (transaction) => {
    const storeProduct = await StoreProduct.findByPk(storeProductId, { transaction })
    if (!storeProduct) {
      throw new AppError(404, "STORE_PRODUCT_NOT_FOUND", "Store product not found")
    }

    const delta = computeDelta(eventType, quantity)

    if (SUBTRACTIVE_TYPES.has(eventType) && storeProduct.quantity_on_hand + delta < 0) {
      throw new AppError(409, "INSUFFICIENT_STOCK", "Not enough inventory")
    }

    // Optimistic lock: UPDATE only if version matches — raw SQL because
    // Sequelize ORM doesn't support WHERE clauses on updates
    const [, rowCount] = await sequelize.query(
      `UPDATE store_products
       SET quantity_on_hand = quantity_on_hand + :delta,
           version = version + 1,
           updated_at = NOW()
       WHERE id = :id AND version = :currentVersion`,
      {
        replacements: { delta, id: storeProductId, currentVersion: storeProduct.version },
        type: QueryTypes.UPDATE,
        transaction,
      },
    )

    if (rowCount === 0) {
      throw new AppError(409, "STALE_VERSION", "Concurrent modification detected, please retry")
    }

    const event = await InventoryEvent.create(
      {
        store_product_id: storeProductId,
        event_type: eventType,
        quantity: delta,
        version: storeProduct.version + 1,
        reference_id: referenceId ?? null,
        reference_type: referenceType ?? null,
        metadata: metadata ?? null,
      },
      { transaction },
    )

    return event
  })
}

async function getEventHistory(
  storeProductId: string,
  options: EventHistoryOptions = {},
): Promise<{ events: InventoryEvent[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100)
  const offset = options.offset ?? 0

  const { rows: events, count: total } = await InventoryEvent.findAndCountAll({
    where: { store_product_id: storeProductId },
    order: [["version", "DESC"]],
    limit,
    offset,
  })

  return { events, total }
}

export { adjustInventory, getEventHistory }
export type { AdjustInventoryParams, EventHistoryOptions }

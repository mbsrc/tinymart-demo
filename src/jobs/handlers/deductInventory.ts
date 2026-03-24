import type { Job } from "pg-boss"
import { InventoryEvent } from "../../models/InventoryEvent.js"
import { Session } from "../../models/Session.js"
import { SessionItem } from "../../models/SessionItem.js"
import { StoreProduct } from "../../models/StoreProduct.js"
import { adjustInventory } from "../../services/inventory.js"
import { logger } from "../../utils/logger.js"
import { recordJobFailure } from "./sendReceipt.js"

export interface DeductInventoryPayload {
  sessionId: string
}

async function processDeduction(job: Job<DeductInventoryPayload>): Promise<void> {
  const { sessionId } = job.data

  const session = await Session.findByPk(sessionId)
  if (!session) {
    logger.warn("deduct-inventory: session not found, skipping", { sessionId })
    return
  }

  // Idempotency: skip if deduction events already exist for this session
  const existing = await InventoryEvent.findOne({
    where: {
      reference_id: sessionId,
      reference_type: "session",
      event_type: "deduct",
    },
  })
  if (existing) {
    logger.info("deduct-inventory: already processed, skipping", { sessionId })
    return
  }

  const items = await SessionItem.findAll({
    where: { session_id: sessionId },
  })

  // Compute net quantities per product: added = +1, removed = -1
  const netByProduct = new Map<string, number>()
  for (const item of items) {
    const current = netByProduct.get(item.product_id) ?? 0
    netByProduct.set(item.product_id, item.action === "added" ? current + 1 : current - 1)
  }

  for (const [productId, net] of netByProduct) {
    if (net <= 0) continue

    const storeProduct = await StoreProduct.findOne({
      where: { store_id: session.store_id, product_id: productId },
    })
    if (!storeProduct) {
      logger.warn("deduct-inventory: store product not found", {
        sessionId,
        storeId: session.store_id,
        productId,
      })
      continue
    }

    await adjustInventory({
      storeProductId: storeProduct.id,
      eventType: "deduct",
      quantity: net,
      referenceId: sessionId,
      referenceType: "session",
    })
  }

  logger.info("deduct-inventory: completed", {
    sessionId,
    productsDeducted: [...netByProduct.entries()].filter(([, n]) => n > 0).length,
  })
}

export async function handleDeductInventory(jobs: Job<DeductInventoryPayload>[]): Promise<void> {
  for (const job of jobs) {
    try {
      await processDeduction(job)
    } catch (error) {
      await recordJobFailure(
        "deduct-inventory",
        job.data as unknown as Record<string, unknown>,
        error,
        0,
      )
      throw error
    }
  }
}

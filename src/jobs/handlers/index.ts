import type { PgBoss } from "pg-boss"
import { logger } from "../../utils/logger.js"
import { handleCleanupIdempotencyKeys } from "./cleanupIdempotencyKeys.js"
import { handleDeductInventory } from "./deductInventory.js"
import { handleSendReceipt } from "./sendReceipt.js"

export async function registerHandlers(boss: PgBoss): Promise<void> {
  await boss.work("send-receipt", handleSendReceipt)
  logger.info("Registered job handler: send-receipt")

  await boss.work("deduct-inventory", handleDeductInventory)
  logger.info("Registered job handler: deduct-inventory")

  await boss.schedule(
    "cleanup-expired-idempotency-keys",
    "0 * * * *",
    {},
    {
      retryLimit: 1,
    },
  )
  await boss.work("cleanup-expired-idempotency-keys", handleCleanupIdempotencyKeys)
  logger.info("Registered scheduled job: cleanup-expired-idempotency-keys (hourly)")
}

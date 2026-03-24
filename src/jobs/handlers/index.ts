import type { PgBoss } from "pg-boss"
import { logger } from "../../utils/logger.js"
import { handleCleanupIdempotencyKeys } from "./cleanupIdempotencyKeys.js"
import { handleDeductInventory } from "./deductInventory.js"
import { handleProcessDeferredCharges } from "./processDeferredCharges.js"
import { handleReplayPendingJobs } from "./replayPendingJobs.js"
import { handleSendReceipt } from "./sendReceipt.js"

export async function registerHandlers(boss: PgBoss): Promise<void> {
  await boss.createQueue("send-receipt")
  await boss.work("send-receipt", handleSendReceipt)
  logger.info("Registered job handler: send-receipt")

  await boss.createQueue("deduct-inventory")
  await boss.work("deduct-inventory", handleDeductInventory)
  logger.info("Registered job handler: deduct-inventory")

  await boss.createQueue("cleanup-expired-idempotency-keys")
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

  await boss.createQueue("replay-pending-jobs")
  await boss.schedule(
    "replay-pending-jobs",
    "*/5 * * * *",
    {},
    {
      retryLimit: 1,
    },
  )
  await boss.work("replay-pending-jobs", handleReplayPendingJobs)
  logger.info("Registered scheduled job: replay-pending-jobs (every 5 min)")

  await boss.createQueue("process-deferred-charges")
  await boss.schedule(
    "process-deferred-charges",
    "*/2 * * * *",
    {},
    {
      retryLimit: 1,
    },
  )
  await boss.work("process-deferred-charges", handleProcessDeferredCharges)
  logger.info("Registered scheduled job: process-deferred-charges (every 2 min)")
}

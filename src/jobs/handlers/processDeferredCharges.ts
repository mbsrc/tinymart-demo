import type { Job } from "pg-boss"
import { processDeferredCharges } from "../../services/deferredCharge.js"
import { logger } from "../../utils/logger.js"

export async function handleProcessDeferredCharges(
  _jobs: Job<Record<string, never>>[],
): Promise<void> {
  const result = await processDeferredCharges()
  logger.info("Process deferred charges job completed", result)
}

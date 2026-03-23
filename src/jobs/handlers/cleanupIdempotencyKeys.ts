import type { Job } from "pg-boss"
import { Op } from "sequelize"
import { IdempotencyKey } from "../../models/IdempotencyKey.js"
import { logger } from "../../utils/logger.js"

export async function handleCleanupIdempotencyKeys(
  _jobs: Job<Record<string, never>>[],
): Promise<void> {
  const deleted = await IdempotencyKey.destroy({
    where: { expires_at: { [Op.lt]: new Date() } },
  })

  logger.info("Cleaned up expired idempotency keys", { deleted_count: deleted })
}

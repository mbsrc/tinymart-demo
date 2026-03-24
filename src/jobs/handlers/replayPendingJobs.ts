import type { Job } from "pg-boss"
import { logger } from "../../utils/logger.js"
import { replayPendingJobs } from "../safeEnqueue.js"

export async function handleReplayPendingJobs(_jobs: Job<Record<string, never>>[]): Promise<void> {
  const replayed = await replayPendingJobs()
  logger.info("Replay pending jobs completed", { replayed })
}

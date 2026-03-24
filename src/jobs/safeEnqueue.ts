import { PendingJob } from "../models/PendingJob.js"
import { logger } from "../utils/logger.js"
import { getJobQueue } from "./queue.js"

export async function safeEnqueue(
  queueName: string,
  payload: Record<string, unknown>,
): Promise<{ enqueued: "pg-boss" | "pending_jobs" }> {
  const boss = getJobQueue()

  if (boss) {
    try {
      await boss.send(queueName, payload)
      logger.info("Job enqueued via pg-boss", { queue: queueName })
      return { enqueued: "pg-boss" }
    } catch (error) {
      logger.warn("pg-boss send failed, falling back to pending_jobs", {
        queue: queueName,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  await PendingJob.create({
    queue_name: queueName,
    payload,
    processed_at: null,
  })

  logger.info("Job saved to pending_jobs fallback table", { queue: queueName })
  return { enqueued: "pending_jobs" }
}

export async function replayPendingJobs(): Promise<number> {
  const boss = getJobQueue()
  if (!boss) return 0

  const pending = await PendingJob.findAll({
    where: { processed_at: null },
    order: [["created_at", "ASC"]],
    limit: 100,
  })

  if (pending.length === 0) return 0

  let replayed = 0

  for (const job of pending) {
    try {
      await boss.send(job.queue_name, job.payload)
      job.processed_at = new Date()
      await job.save()
      replayed++
    } catch (error) {
      // Stop replaying on first failure — queue may be going down again
      logger.warn("Replay stopped: pg-boss send failed", {
        queue: job.queue_name,
        job_id: job.id,
        error: error instanceof Error ? error.message : String(error),
      })
      break
    }
  }

  if (replayed > 0) {
    logger.info("Replayed pending jobs into pg-boss", {
      replayed,
      remaining: pending.length - replayed,
    })
  }

  return replayed
}

import type { Job } from "pg-boss"
import { JobFailure } from "../../models/JobFailure.js"
import { Session } from "../../models/Session.js"
import { SessionItem } from "../../models/SessionItem.js"
import { Transaction } from "../../models/Transaction.js"
import { logger } from "../../utils/logger.js"

export interface SendReceiptPayload {
  sessionId: string
  transactionId: string
}

async function processReceipt(job: Job<SendReceiptPayload>): Promise<void> {
  const { sessionId, transactionId } = job.data

  const transaction = await Transaction.findByPk(transactionId)
  if (!transaction) {
    logger.warn("send-receipt: transaction not found, skipping", { transactionId })
    return
  }

  // Idempotent: skip if not in succeeded state
  if (transaction.status !== "succeeded") {
    logger.info("send-receipt: transaction not in succeeded state, skipping", {
      transactionId,
      status: transaction.status,
    })
    return
  }

  const session = await Session.findByPk(sessionId, {
    include: [{ model: SessionItem }],
  })

  const itemCount = session?.SessionItems?.length ?? 0

  // In a real app, this would send an email/SMS. For this demo, we log it.
  logger.info("Receipt sent", {
    transactionId,
    sessionId,
    totalCents: transaction.total_cents,
    itemCount,
    stripeChargeId: transaction.stripe_charge_id,
  })
}

export async function handleSendReceipt(jobs: Job<SendReceiptPayload>[]): Promise<void> {
  for (const job of jobs) {
    try {
      await processReceipt(job)
    } catch (error) {
      await recordJobFailure(
        "send-receipt",
        job.data as unknown as Record<string, unknown>,
        error,
        0,
      )
      throw error
    }
  }
}

export async function recordJobFailure(
  jobName: string,
  payload: Record<string, unknown>,
  error: unknown,
  attempts: number,
): Promise<void> {
  try {
    await JobFailure.create({
      job_name: jobName,
      payload,
      error_message: error instanceof Error ? error.message : String(error),
      attempts,
      last_attempted_at: new Date(),
    })
    logger.error("Job moved to dead letter", {
      job_name: jobName,
      attempts,
      error: error instanceof Error ? error.message : String(error),
    })
  } catch (dlqError) {
    logger.error("Failed to record job failure in dead letter table", {
      job_name: jobName,
      error: dlqError instanceof Error ? dlqError.message : String(dlqError),
    })
  }
}

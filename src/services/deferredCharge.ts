import { DeferredCharge } from "../models/DeferredCharge.js"
import { logger } from "../utils/logger.js"
import { capturePaymentIntent, stripeCircuitBreaker } from "./stripe.js"

const MAX_DEFERRED_ATTEMPTS = 5

export interface CaptureResult {
  outcome: "captured" | "deferred"
  deferredChargeId?: string
}

export async function captureOrDefer(
  sessionId: string,
  paymentIntentId: string,
  amountCents: number,
): Promise<CaptureResult> {
  if (process.env.E2E_MOCK_STRIPE === "true") {
    return { outcome: "captured" }
  }

  const circuitState = stripeCircuitBreaker.getState()

  if (circuitState === "closed" || circuitState === "half_open") {
    try {
      await capturePaymentIntent(paymentIntentId, {
        amount_to_capture: amountCents,
      })
      return { outcome: "captured" }
    } catch (error) {
      // If the call failed and the circuit just opened, fall through to defer
      if (stripeCircuitBreaker.getState() !== "open") {
        throw error
      }
      logger.warn("Stripe capture failed and circuit opened, deferring capture", {
        session_id: sessionId,
        payment_intent_id: paymentIntentId,
      })
    }
  }

  const deferred = await DeferredCharge.create({
    session_id: sessionId,
    amount: amountCents,
    currency: "usd",
    stripe_params: {
      payment_intent_id: paymentIntentId,
      amount_to_capture: amountCents,
    },
  })

  logger.info("Capture deferred due to Stripe unavailability", {
    session_id: sessionId,
    deferred_charge_id: deferred.id,
    payment_intent_id: paymentIntentId,
    amount: amountCents,
  })

  return { outcome: "deferred", deferredChargeId: deferred.id }
}

export async function processDeferredCharges(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const pending = await DeferredCharge.findAll({
    where: { status: "pending" },
    order: [["created_at", "ASC"]],
    limit: 50,
  })

  if (pending.length === 0) return { processed: 0, succeeded: 0, failed: 0 }

  // Don't bother processing if Stripe is still down
  if (stripeCircuitBreaker.getState() === "open") {
    logger.info("Skipping deferred charge processing — Stripe circuit is open", {
      pending_count: pending.length,
    })
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const charge of pending) {
    try {
      const params = charge.stripe_params as {
        payment_intent_id: string
        amount_to_capture: number
      }
      await capturePaymentIntent(params.payment_intent_id, {
        amount_to_capture: params.amount_to_capture,
      })

      charge.status = "succeeded"
      charge.processed_at = new Date()
      charge.attempts = charge.attempts + 1
      await charge.save()
      succeeded++
    } catch (error) {
      charge.attempts = charge.attempts + 1
      charge.last_error = error instanceof Error ? error.message : String(error)

      if (charge.attempts >= MAX_DEFERRED_ATTEMPTS) {
        charge.status = "failed"
        logger.error("Deferred capture permanently failed", {
          deferred_charge_id: charge.id,
          session_id: charge.session_id,
          attempts: charge.attempts,
        })
      }

      await charge.save()
      failed++

      // If circuit just opened again, stop processing the batch
      if (stripeCircuitBreaker.getState() === "open") {
        logger.warn("Stripe circuit opened during deferred charge processing, stopping batch")
        break
      }
    }
  }

  logger.info("Deferred charge processing complete", {
    processed: succeeded + failed,
    succeeded,
    failed,
  })

  return { processed: succeeded + failed, succeeded, failed }
}

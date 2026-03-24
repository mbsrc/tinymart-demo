import type Stripe from "stripe"
import { DeferredCharge } from "../models/DeferredCharge.js"
import { logger } from "../utils/logger.js"
import { createPaymentIntent, stripeCircuitBreaker } from "./stripe.js"

const MAX_DEFERRED_ATTEMPTS = 5

export interface ChargeResult {
  outcome: "charged" | "deferred"
  paymentIntent?: Stripe.PaymentIntent
  deferredChargeId?: string
}

export async function chargeOrDefer(
  sessionId: string,
  params: Stripe.PaymentIntentCreateParams,
): Promise<ChargeResult> {
  const circuitState = stripeCircuitBreaker.getState()

  if (circuitState === "closed" || circuitState === "half_open") {
    try {
      const paymentIntent = await createPaymentIntent(params)
      return { outcome: "charged", paymentIntent }
    } catch (error) {
      // If the call failed and the circuit just opened, fall through to defer
      if (stripeCircuitBreaker.getState() !== "open") {
        throw error
      }
      logger.warn("Stripe call failed and circuit opened, deferring charge", {
        session_id: sessionId,
      })
    }
  }

  const deferred = await DeferredCharge.create({
    session_id: sessionId,
    amount: params.amount as number,
    currency: (params.currency as string) ?? "usd",
    stripe_params: params as unknown as Record<string, unknown>,
  })

  logger.info("Charge deferred due to Stripe unavailability", {
    session_id: sessionId,
    deferred_charge_id: deferred.id,
    amount: params.amount,
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
      await createPaymentIntent(charge.stripe_params as unknown as Stripe.PaymentIntentCreateParams)

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
        logger.error("Deferred charge permanently failed", {
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

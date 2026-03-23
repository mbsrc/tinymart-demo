import Stripe from "stripe"
import { config } from "../config/index.js"
import { AppError } from "../types/index.js"
import { logger } from "../utils/logger.js"

const stripe = new Stripe(config.stripeSecretKey)

const PRE_AUTH_AMOUNT_CENTS = 5000

export interface PreAuthResult {
  paymentIntentId: string
  customerId: string | null
}

export interface CaptureResult {
  chargeId: string | null
  status: "succeeded" | "failed"
}

export async function createPreAuth(
  paymentMethodId: string,
  amountCents?: number,
): Promise<PreAuthResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents ?? PRE_AUTH_AMOUNT_CENTS,
      currency: "usd",
      payment_method: paymentMethodId,
      capture_method: "manual",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    })
    return {
      paymentIntentId: paymentIntent.id,
      customerId: typeof paymentIntent.customer === "string" ? paymentIntent.customer : null,
    }
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function capturePayment(
  paymentIntentId: string,
  amountCents: number,
): Promise<CaptureResult> {
  try {
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, {
      amount_to_capture: amountCents,
    })
    const chargeId = paymentIntent.latest_charge
    return {
      chargeId: typeof chargeId === "string" ? chargeId : null,
      status: "succeeded",
    }
  } catch (error) {
    throw mapStripeError(error)
  }
}

export async function cancelPreAuth(paymentIntentId: string): Promise<void> {
  try {
    await stripe.paymentIntents.cancel(paymentIntentId)
  } catch (error) {
    logger.warn("Failed to cancel PaymentIntent", {
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export function mapStripeError(error: unknown): AppError {
  if (error instanceof Stripe.errors.StripeCardError) {
    return new AppError(422, "CARD_DECLINED", error.message)
  }
  if (error instanceof Stripe.errors.StripeInvalidRequestError) {
    return new AppError(400, "STRIPE_INVALID_REQUEST", error.message)
  }
  if (
    error instanceof Stripe.errors.StripeAPIError ||
    error instanceof Stripe.errors.StripeConnectionError
  ) {
    return new AppError(502, "STRIPE_UNAVAILABLE", "Payment service temporarily unavailable")
  }
  if (error instanceof Stripe.errors.StripeError) {
    return new AppError(500, "STRIPE_ERROR", error.message)
  }
  if (error instanceof AppError) return error
  return new AppError(500, "INTERNAL_ERROR", "An unexpected payment error occurred")
}

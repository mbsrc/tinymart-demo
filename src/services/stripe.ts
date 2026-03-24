import Stripe from "stripe"
import { config } from "../config/index.js"
import { CircuitBreaker } from "../utils/circuitBreaker.js"
import { isRetryableStripeError, retryWithBackoff } from "../utils/retry.js"

const stripe = new Stripe(config.stripeSecretKey)

export const stripeCircuitBreaker = new CircuitBreaker({
  name: "Stripe",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxAttempts: 1,
})

async function resilientCall<T>(fn: () => Promise<T>): Promise<T> {
  return stripeCircuitBreaker.execute(() =>
    retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      shouldRetry: isRetryableStripeError,
    }),
  )
}

export async function createPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
): Promise<Stripe.PaymentIntent> {
  return resilientCall(() => stripe.paymentIntents.create(params))
}

export async function capturePaymentIntent(
  id: string,
  params?: Stripe.PaymentIntentCaptureParams,
): Promise<Stripe.PaymentIntent> {
  return resilientCall(() => stripe.paymentIntents.capture(id, params))
}

export async function cancelPaymentIntent(
  id: string,
  params?: Stripe.PaymentIntentCancelParams,
): Promise<Stripe.PaymentIntent> {
  return resilientCall(() => stripe.paymentIntents.cancel(id, params))
}

export async function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
): Promise<Stripe.Event> {
  // Webhook signature verification is synchronous and local — no circuit breaker needed
  if (!config.stripeWebhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured")
  }
  return stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret)
}

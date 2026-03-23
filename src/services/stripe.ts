export interface PreAuthResult {
  paymentIntentId: string | null
  customerId: string | null
}

export interface CaptureResult {
  chargeId: string | null
  status: "succeeded" | "failed"
}

export async function createPreAuth(
  _paymentMethodId: string | null,
  _amountCents?: number,
): Promise<PreAuthResult> {
  // V1 stub — replaced with real Stripe in step 5
  return { paymentIntentId: null, customerId: null }
}

export async function capturePayment(
  _paymentIntentId: string | null,
  _amountCents: number,
): Promise<CaptureResult> {
  // V1 stub — always succeeds
  return { chargeId: null, status: "succeeded" }
}

export async function cancelPreAuth(_paymentIntentId: string | null): Promise<void> {
  // V1 stub — no-op
}

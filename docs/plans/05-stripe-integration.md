# Step 5: Stripe Integration

## Context
Replaces the Stripe stub from step 4 with real Stripe SDK calls. Uses PaymentIntent with manual capture: pre-authorize on open, capture exact total on close.

## Changes (no new endpoints)
- **`src/services/stripe.ts`** — replace stubs with real `stripe` SDK calls:
  - `createPreAuth(paymentMethodId, amount?)` → `stripe.paymentIntents.create({ capture_method: "manual", confirm: true })`
  - `capturePayment(piId, amount)` → `stripe.paymentIntents.capture(piId, { amount_to_capture })`
  - `cancelPreAuth(piId)` → `stripe.paymentIntents.cancel(piId)` (for empty carts)
  - `mapStripeError(error)` → converts Stripe errors to AppError:
    - `StripeCardError` → 422 `CARD_DECLINED`
    - `StripeConnectionError` / `StripeAPIError` → 502 `STRIPE_UNAVAILABLE`
    - `StripeInvalidRequestError` → 400 `STRIPE_INVALID_REQUEST`
- **`src/routes/sessions.ts`** — update:
  - Open: if `stripe_payment_method_id` provided, call real `createPreAuth`, store `paymentIntentId` + `customerId`. If not provided, skip Stripe (backward compat for tests).
  - Close: if `session.stripe_payment_intent_id` exists, call real `capturePayment`. On failure: set session to `failed`, create failed Transaction.
  - Empty cart close: call `cancelPreAuth` to release hold.
- **Pre-auth amount:** Fixed $50 (5000 cents) ceiling. Captured amount = actual cart total.

## Key Decisions
- **Backward compat:** Sessions without `stripe_payment_method_id` skip Stripe calls (keeps existing tests passing, enables easy manual testing)
- **No webhooks for V1** — synchronous capture-on-close is sufficient
- **Tests mock Stripe** — `vi.mock("../src/services/stripe.js")` so tests stay fast and don't need real keys

## Tests
- Stripe error mapping: StripeCardError → 422, StripeInvalidRequestError → 400, StripeAPIError → 502, StripeConnectionError → 502, unknown → 500
- Existing session tests still pass (no Stripe calls without payment method)

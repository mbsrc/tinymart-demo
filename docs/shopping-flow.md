# Shopping Flow — End-to-End Reference

The complete lifecycle of a shopping session, from card tap to receipt (or cancellation).

## Overview

```
Tap Card → Pre-Auth Hold → Open Fridge → Grab Items → Close Door → Capture/Cancel → Receipt
```

The key architectural decision: **pre-authorize first, capture later**. When a shopper taps their card, Stripe places a $50 hold (`capture_method: "manual"`). The actual charge only happens when the door closes — and only for the items taken. If the cart is empty, the hold is released. If Stripe is down at capture time, the charge is deferred and retried automatically.

---

## Phase 1: Session Open (Card Tap)

**Endpoint:** `POST /api/sessions`
**Auth:** None (kiosk is public)

### What happens

1. Shopper enters card via Stripe Elements (`CardElement`) in the kiosk UI
2. Stripe.js creates a `PaymentMethod` client-side (`pm_xxx`)
3. Frontend sends `{ store_id, stripe_payment_method_id }` to the API
4. Backend validates the store exists and is `online`
5. Backend calls `stripe.paymentIntents.create()` with:
   - `amount: 5000` ($50 ceiling)
   - `capture_method: "manual"` (hold, don't charge)
   - `payment_method: pm_xxx`
   - `confirm: true` (authorize immediately)
6. Creates a `sessions` row: `status: "open"`, stores `stripe_payment_method_id` and `stripe_payment_intent_id`

### Database state after

| Table | State |
|-------|-------|
| `sessions` | `status: "open"`, `stripe_payment_intent_id: "pi_xxx"` |
| `session_items` | Empty |

### Stripe state

PaymentIntent: `status: "requires_capture"`, `amount: 5000`

---

## Phase 2: Shopping (Add/Remove Items)

**Endpoint:** `POST /api/sessions/:id/items`
**Auth:** None

### What happens

1. Shopper taps product cards in the kiosk UI
2. Each tap sends `{ product_id, action: "added" }` to the API
3. Removing an item sends `{ product_id, action: "removed" }`
4. Backend validates:
   - Session exists and is `open`
   - Product exists and belongs to the session's store
5. Creates a `session_items` row per action (append-only event log)

### Cart reconciliation

Items are event-sourced. The cart is derived by `reconcileCart()`:

```
Added: Cola, Cola, Energy Bar, Sandwich
Removed: Cola
─────────────────
Net: Cola ×1, Energy Bar ×1, Sandwich ×1
```

The frontend runs the same reconciliation algorithm client-side for optimistic UI updates.

### Database state during shopping

| Table | State |
|-------|-------|
| `sessions` | `status: "open"` (unchanged) |
| `session_items` | One row per add/remove event |

---

## Phase 3a: Close with Items (Charge)

**Endpoint:** `POST /api/sessions/:id/close`
**Auth:** None

### What happens

1. Shopper clicks "Close Door & Pay"
2. Backend reconciles the cart → net quantities
3. Looks up `price_cents` for each product, computes `total_cents`
4. Validates stock availability for all items
5. Inside a database transaction:
   - Deducts inventory via `adjustInventory()` (creates `inventory_events`)
   - Calls `captureOrDefer(sessionId, paymentIntentId, totalCents)`:
     - If Stripe circuit is closed → `capturePaymentIntent(pi_xxx, { amount_to_capture: totalCents })`
     - If Stripe circuit is open → saves to `deferred_charges` table for later retry
   - Creates `transactions` row with `total_cents` and `status`
   - Updates session: `status: "charged"`, sets `closed_at` and `charged_at`
6. After commit: enqueues `send-receipt` job via `safeEnqueue()` (best-effort, non-blocking)

### Database state after

| Table | State |
|-------|-------|
| `sessions` | `status: "charged"`, `closed_at` and `charged_at` set |
| `transactions` | `total_cents: 997`, `status: "succeeded"` |
| `inventory_events` | One `deduct` event per product in cart |
| `store_products` | `quantity_on_hand` decremented |

### Stripe state

PaymentIntent: `status: "succeeded"`, `amount_received: 997` (captured from $50 hold)

---

## Phase 3b: Close with Empty Cart (No Charge)

**Endpoint:** `POST /api/sessions/:id/close`
**Auth:** None

### What happens

1. Shopper clicks "Close Door" (button label adapts when cart is empty)
2. Backend reconciles the cart → empty
3. Cancels the pre-auth hold: `cancelPaymentIntent(pi_xxx)`
4. Updates session: `status: "closed"`, sets `closed_at`
5. No transaction created, no inventory changes

### Database state after

| Table | State |
|-------|-------|
| `sessions` | `status: "closed"`, `closed_at` set, no `charged_at` |
| `transactions` | No row |
| `inventory_events` | No new events |

### Stripe state

PaymentIntent: `status: "canceled"` (hold released, card not charged)

---

## Phase 3c: Close with Stripe Down (Deferred Charge)

**Endpoint:** `POST /api/sessions/:id/close`

### What happens

1. Cart reconciled, inventory deducted (same as 3a)
2. `captureOrDefer()` checks circuit breaker state → **open**
3. Saves capture intent to `deferred_charges` table:
   - `session_id`, `payment_intent_id`, `amount`, `status: "pending"`
4. Session set to `status: "failed"`, transaction to `status: "pending"`
5. Background job `process-deferred-charges` (runs every 2 min) retries:
   - Calls `capturePaymentIntent()` with stored PI ID and amount
   - On success: updates `deferred_charges.status` to `"succeeded"`
   - On failure: increments `attempts`, retries up to 5 times

---

## Reliability Patterns in the Flow

### Pre-authorization hold
The $50 hold is placed when the session opens, before shopping begins. This ensures funds are reserved even if Stripe goes down during checkout. The hold window gives time for deferred captures to process.

### Idempotency
All mutation endpoints require an `Idempotency-Key` header. The frontend auto-generates `crypto.randomUUID()` for each request. Replayed requests return the cached response instead of executing twice.

### Circuit breaker (Stripe)
Wraps all Stripe calls. After 5 consecutive failures, the circuit opens and rejects calls fast (503) for 30 seconds instead of letting them timeout. Probe request after 30s determines if Stripe recovered.

### Event-sourced cart
Session items are append-only events (`added`/`removed`), not a mutable cart. This provides a full audit trail and eliminates race conditions from concurrent modifications.

### Optimistic locking (inventory)
`store_products.version` column prevents concurrent deductions from over-selling. `UPDATE ... WHERE version = :currentVersion` fails if another request modified the row first.

### Safe job enqueue
`safeEnqueue()` tries pg-boss first. If the job queue is down, it falls back to the `pending_jobs` database table. A periodic job replays pending jobs when the queue recovers.

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/sessions/store/:storeId` | No | Get store + products for kiosk |
| `POST` | `/api/sessions` | No | Open session with optional card pre-auth |
| `GET` | `/api/sessions/:id` | No | Get session with items and transaction |
| `POST` | `/api/sessions/:id/items` | No | Add/remove item (`action: "added" \| "removed"`) |
| `POST` | `/api/sessions/:id/close` | No | Reconcile, charge/cancel, deduct inventory |
| `GET` | `/api/sessions/:id/transaction` | No | Get transaction for a session |

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/sessions.ts` | All session endpoints + close logic |
| `src/utils/reconcileCart.ts` | Cart reconciliation (event → net quantities) |
| `src/services/deferredCharge.ts` | `captureOrDefer()` + deferred charge processing |
| `src/services/stripe.ts` | Stripe API wrapper with circuit breaker + retry |
| `src/services/inventory.ts` | `adjustInventory()` with optimistic locking |
| `src/jobs/safeEnqueue.ts` | Resilient job enqueueing with DB fallback |
| `client/src/pages/KioskPage.tsx` | Kiosk state machine (idle → shopping → closing → receipt) |
| `client/src/components/kiosk/CartSidebar.tsx` | Cart display with +/- buttons |
| `client/src/utils/reconcileCart.ts` | Client-side cart reconciliation (mirrors backend) |

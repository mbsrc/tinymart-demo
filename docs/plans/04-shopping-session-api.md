# Step 4: Shopping Session API

## Context
Builds the core shopping lifecycle. Stripe calls are **stubbed** — step 5 wires in real Stripe. Introduces cart reconciliation logic as a pure, testable function.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sessions` | No | Open session (body: `store_id`, `stripe_payment_method_id?`) |
| `POST` | `/api/sessions/:id/items` | No | Add/remove item (body: `product_id`, `action`) |
| `POST` | `/api/sessions/:id/close` | No | Reconcile cart, charge, deduct inventory |
| `GET` | `/api/sessions/:id` | No | Get session details |

## Key Decisions
- **No auth** — shoppers are anonymous (physical fridge controls access in real world)
- **Stripe stub:** `src/services/stripe.ts` exports `createPreAuth()` and `capturePayment()` that return dummy values. Step 5 replaces with real SDK calls.
- **Cart reconciliation** as pure function in `src/utils/reconcileCart.ts`:
  - Input: array of `{ product_id, action }` session items
  - For each product: count "added" minus "removed" = net quantity
  - Output: items with net quantity > 0 only
- **Close flow (V1):**
  1. Validate session is `open`
  2. Reconcile cart → get net items
  3. Look up `price_cents` for each product, calculate `total_cents`
  4. Inside a Sequelize managed transaction:
     - Deduct `quantity_on_hand` from `store_products` per item
     - Create `Transaction` record (status: succeeded for stub)
     - Update session: status → `charged`, set `closed_at` + `charged_at`
  5. Return transaction summary
- **Empty cart:** Close session with status `closed` (not `charged`), no transaction created
- **Store must be `online`** to open a session → 422 if offline/maintenance

## Tests
- Unit: reconcileCart with add/remove/duplicates/empty/net-negative
- Integration: open/add/remove/close lifecycle, empty cart, state validation (can't add to closed session, can't close twice), inventory deduction verified, store must be online

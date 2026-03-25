# Plan 20: UI Preparation

## Goal
Wire up the missing shopping session endpoints and harden the API so a browser-based UI can connect. Models, migrations, Stripe service, and inventory system all exist — this plan builds the HTTP layer on top.

## Design Decisions

### Auth model for sessions
- Sessions are **unauthenticated** — shoppers are anonymous (per Plan 04). The physical fridge controls access in the real world.
- Operator endpoints (`/api/stores`, `/api/products`) keep `x-api-key` auth.
- Session endpoints (`/api/sessions`) are public — no `authenticateOperator` middleware.

### CORS
- Add `cors` package with configurable allowed origins via `CORS_ALLOWED_ORIGINS` env var.
- Default to `*` in development, explicit origins in production.

### Session close flow
1. Validate session is `open`
2. Reconcile cart → net items (pure function)
3. Look up `price_cents` for each product, compute `total_cents`
4. Inside a Sequelize transaction:
   - Deduct `quantity_on_hand` via `adjustInventory()` for each item
   - Call `captureOrDefer()` to capture the pre-authorized PaymentIntent (handles Stripe outages)
   - Create `Transaction` record
   - Update session status → `charged` (or `failed`)
5. Return transaction summary

## Sub-steps

### 20a. CORS + security hardening
- Install `cors` and `helmet` packages
- Add CORS middleware after body parsers, before correlation ID
- Add `helmet()` as first middleware
- Add body size limit: `express.json({ limit: "100kb" })`
- Add `CORS_ALLOWED_ORIGINS` to config
- Update `.env.example` with new env var
- **Test:** verify CORS headers appear on responses

### 20b. Cart reconciliation utility
- **File:** `src/utils/reconcileCart.ts`
- Pure function: takes `SessionItem[]`, returns `{ product_id: string, quantity: number }[]`
- For each product: count `added` minus `removed` = net quantity
- Only include items with net quantity > 0
- **Test:** unit tests for add/remove/duplicates/empty/net-negative

### 20c. Session endpoints
- **File:** `src/routes/sessions.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/sessions` | No | Open session (`store_id` required, `stripe_payment_method_id` optional) |
| `GET` | `/api/sessions/:id` | No | Get session with items and transaction |
| `POST` | `/api/sessions/:id/items` | No | Add/remove item (`product_id`, `action: "added" \| "removed"`) |
| `POST` | `/api/sessions/:id/close` | No | Reconcile cart, charge, deduct inventory |

Validation rules:
- Store must exist and be `online` to open session → 422
- Session must be `open` to add items or close → 409
- Can't close twice → 409
- Product must exist and be in the session's store → 404
- Empty cart → close with status `closed` (no charge, no transaction)
- Insufficient stock during close → 409 with partial error info

Mount in `app.ts`: `app.use("/api/sessions", idempotency, sessionsRouter)` — no auth middleware.

### 20d. Transaction endpoint
- **File:** add to `src/routes/sessions.ts` or new `src/routes/transactions.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/sessions/:id/transaction` | No | Get transaction for a session |

### 20e. Integration tests
- **File:** `tests/sessions.test.ts`
- Open → add items → close → verify transaction
- Empty cart close (no charge)
- Store must be online
- Can't add to closed session
- Can't close twice
- Insufficient stock during close
- Idempotent close (same idempotency key)

### 20f. E2E shopping flow test
- **File:** `tests/e2e/shopping-flow.test.ts`
- Full journey: create store (as operator) → open session → add items → close → verify charge + inventory deducted + events created

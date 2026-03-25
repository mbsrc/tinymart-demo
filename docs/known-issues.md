# Known Issues

## Pre-Production Reliability Audit (2026-03-24)

Systematic review of every file in `src/` covering error handling, data integrity,
external service resilience, payment safety, database performance, async/job safety,
observability, and security.

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| WARNING | 9 |
| INFO | 6 |
| **Total** | **19** |

### Top 3 Priorities

1. Fix the double-close race condition (`sessions.ts`)
2. Make inventory deductions atomic with session close (`sessions.ts` / `inventory.ts`)
3. Add Stripe idempotency keys to payment creation (`stripe.ts` / `deferredCharge.ts`)

---

### [CRITICAL] Double-close race condition on session close

**File:** `src/routes/sessions.ts:130-138`
**Issue:** The `status !== "open"` guard runs OUTSIDE the database transaction. Two concurrent `POST /:id/close` requests can both read the session as "open", both pass the guard, and both enter the transaction block — resulting in double inventory deduction and double Stripe charges.
**Impact:** Customers charged twice for the same session. Inventory deducted twice.
**Fix:** Acquire a `SELECT ... FOR UPDATE` lock on the session row at the start of the transaction, then re-check status inside the transaction. Alternatively, add optimistic locking (version column) to the Session model and check it in the UPDATE.

---

### [CRITICAL] Inventory deductions are NOT atomic with session close

**File:** `src/routes/sessions.ts:191-201` and `src/services/inventory.ts:39`
**Issue:** The comment says "all-or-nothing" but `adjustInventory()` opens its own `sequelize.transaction()` internally. The inventory deductions commit independently from the outer transaction `t`. If the Stripe call or `session.update()` fails, the outer transaction rolls back the `Transaction.create` and session status change — but the inventory has already been permanently deducted.
**Impact:** Inventory phantom deductions on failed charges. Stock counts drift lower over time with no compensation.
**Fix:** Pass the outer transaction `t` into `adjustInventory()` as an optional parameter so all mutations happen in a single transaction. Add a `transaction` option to the `AdjustInventoryParams` interface.

---

### [CRITICAL] No Stripe idempotency keys on payment creation

**File:** `src/services/stripe.ts:28` and `src/services/deferredCharge.ts:29,84`
**Issue:** `createPaymentIntent` wraps the Stripe call in retry logic (up to 3 retries), but never passes an idempotency key to Stripe. If a network timeout occurs after Stripe processes the request but before the response arrives, the retry creates a second PaymentIntent. The same applies to deferred charge processing.
**Impact:** Duplicate Stripe charges. Real money lost.
**Fix:** Generate a UUID-based idempotency key per call and pass it as the second argument: `stripe.paymentIntents.create(params, { idempotencyKey })`. For deferred charges, use `deferred_charge.id` as the idempotency key.

---

### [CRITICAL] Session marked "failed" when charge is deferred

**File:** `src/routes/sessions.ts:210`
**Issue:** `const sessionStatus = chargeResult.outcome === "charged" ? "charged" : "failed"` — when Stripe is down and the charge is deferred, the session is marked "failed" even though items were taken and the charge is pending.
**Impact:** Customer sees a "failed" session despite items being removed from the fridge and inventory being deducted. If the deferred charge later succeeds, the session still shows "failed" — no reconciliation updates it. Retry logic checking for "failed" sessions could attempt to re-close them.
**Fix:** Add a "pending" or "deferred" status to the session, or use "closed" with `charged_at = null`. Update the session status when the deferred charge eventually succeeds or permanently fails.

---

### [WARNING] Health routes missing asyncHandler

**File:** `src/routes/health.ts:24,60`
**Issue:** `/health/ready` and `/health/detailed` are async handlers but are NOT wrapped in `asyncHandler`. Express 4 does not catch rejected promises from raw async route handlers. If `dependencyRegistry.checkAll()` or the inner queries throw, the error becomes an unhandled rejection — the client hangs and the process may crash.
**Impact:** Unhandled rejection crashes the process. Health check monitors see timeouts and may incorrectly restart healthy instances.
**Fix:** Wrap both handlers with `asyncHandler`, or add try/catch blocks.

---

### [WARNING] API keys stored in plaintext

**File:** `src/models/Operator.ts:9` and `src/middleware/auth.ts:23`
**Issue:** API keys are stored as plain strings in the database and looked up with a direct equality check. If the database is compromised, all operator API keys are immediately usable.
**Impact:** Full account takeover on database breach.
**Fix:** Hash API keys with a fast, non-reversible hash (SHA-256 is sufficient for high-entropy API keys). Store the hash, compare against it on auth. Display the raw key only once at creation time.

---

### [WARNING] /health/detailed exposes internals without auth

**File:** `src/routes/health.ts:60-100`
**Issue:** The detailed health endpoint is unauthenticated and exposes `process.memoryUsage()`, `process.uptime()`, circuit breaker states, job queue internals, and dead letter counts.
**Impact:** Information disclosure aids attackers in profiling the system (heap size, uptime for timing attacks, dependency availability).
**Fix:** Either gate this endpoint behind `authenticateOperator` or restrict it to internal networks / a separate management port.

---

### [WARNING] deduct-inventory idempotency check is incomplete

**File:** `src/jobs/handlers/deductInventory.ts:24-34`
**Issue:** The idempotency check looks for ANY existing deduction event for the session. If a multi-product deduction partially completed (2 of 3 products deducted, then crash), the replay would find the first event and skip — leaving the 3rd product never deducted.
**Impact:** Partial inventory deductions go undetected.
**Fix:** Check the count of deducted products against the expected count from the session's reconciled cart, or track deduction completeness with a status flag.

---

### [WARNING] sendReceipt handler silently swallows failures

**File:** `src/jobs/handlers/sendReceipt.ts:47-51`
**Issue:** `handleSendReceipt` doesn't have a try/catch and doesn't call `recordJobFailure`. Unlike `handleDeductInventory` which records failures to the dead letter table, receipt failures are only handled by pg-boss's internal retry. After retries exhaust, the failure is invisible.
**Impact:** Failed receipts silently disappear. No operational visibility.
**Fix:** Add the same try/catch + `recordJobFailure` pattern used in `handleDeductInventory`.

---

### [RESOLVED] send-receipt job is now wired up

The `send-receipt` job is enqueued via `safeEnqueue()` after successful session close. Inventory deduction remains inline within the session close transaction — this is intentional for atomicity (full rollback if anything fails). The `deduct-inventory` handler is kept as a fallback for future async deduction scenarios but is not triggered in the current flow.

---

### [WARNING] Separate connection pool for pg-boss

**File:** `src/jobs/queue.ts:9-11`
**Issue:** pg-boss is initialized with only `connectionString`, creating its own connection pool (default 10 connections). Combined with the app's pool (max 5), this totals 15+ connections. Heroku basic plans allow 20 connections. With 2 dynos you'd hit the limit.
**Impact:** Connection exhaustion under scaling. Database refuses connections.
**Fix:** Pass `pool: { max: 3 }` to pg-boss config, or share the Sequelize pool by passing pg-boss the existing connection.

---

### [WARNING] Products and stores list endpoints have no pagination

**File:** `src/routes/products.ts:70` and `src/routes/stores.ts:33`
**Issue:** `Product.findAll` and `Store.findAll` return all records for an operator without a `LIMIT`. As catalog grows, these become increasingly expensive.
**Impact:** Slow responses, high memory usage, potential OOM on large catalogs.
**Fix:** Add `limit` and `offset` query parameters with a default limit (e.g., 50) and a max cap (e.g., 100), matching the pattern already used in `transactions.ts`.

---

### [WARNING] Missing input validation on numeric fields

**File:** `src/routes/stores.ts:66,80-81`
**Issue:** `quantity_on_hand` and `low_stock_threshold` from `req.body` are passed directly to Sequelize without type or range validation. A string, negative number, or float would be accepted.
**Impact:** Invalid inventory data in the database. A negative `quantity_on_hand` bypasses stock checks.
**Fix:** Add validation: `if (quantity_on_hand !== undefined && (!Number.isInteger(quantity_on_hand) || quantity_on_hand < 0))`.

---

### [WARNING] dependencyRegistry interval not unref'd

**File:** `src/services/dependencyRegistry.ts:93`
**Issue:** The monitoring `setInterval` is not `.unref()`'d, unlike the rate limiter's cleanup timer. This keeps the Node.js event loop alive during shutdown, potentially extending the shutdown window.
**Impact:** Graceful shutdown may hang until the 15-second force-kill timer fires.
**Fix:** Add `.unref()` to the interval, like the rate limiter does at `rateLimiter.ts:26`.

---

### [INFO] N+1 queries in session close cart detail lookup

**File:** `src/routes/sessions.ts:156-186`
**Issue:** Each cart line triggers a separate `StoreProduct.findOne` query inside `Promise.all`. For a cart with N items, this is N database round-trips.
**Impact:** Slower session close for large carts.
**Fix:** Batch into a single query: `StoreProduct.findAll({ where: { store_id, product_id: { [Op.in]: productIds } }, include: [Product] })`.

---

### [INFO] Missing indexes on transactions.status and transactions.created_at

**File:** `src/migrations/20260323000007-create-transactions.ts`
**Issue:** The transactions list endpoint filters by `status` and orders/filters by `created_at`, but neither column is indexed. Only `session_id` and `store_id` have indexes.
**Impact:** Full table scans on transaction listing as table grows.
**Fix:** Add a composite index on `(store_id, created_at DESC)` and a partial index on `status`.

---

### [INFO] constructWebhookEvent throws raw Error

**File:** `src/services/stripe.ts:51`
**Issue:** `throw new Error("STRIPE_WEBHOOK_SECRET is not configured")` instead of `AppError`. This will be caught by the error handler as a 500 INTERNAL_ERROR rather than a properly coded operational error.
**Impact:** Misleading error response if webhook secret is misconfigured.
**Fix:** `throw new AppError(500, "STRIPE_CONFIG_ERROR", "STRIPE_WEBHOOK_SECRET is not configured", false)`.

---

### [INFO] CORS defaults to wildcard

**File:** `src/config/index.ts:34`
**Issue:** When `CORS_ALLOWED_ORIGINS` is not set, CORS defaults to `["*"]`. This is fine for development but risky if forgotten in production.
**Impact:** Any origin can make credentialed requests.
**Fix:** Consider requiring explicit CORS origins in production: `if (nodeEnv === "production" && !process.env.CORS_ALLOWED_ORIGINS) throw`.

---

### [INFO] SSL rejectUnauthorized: false in production

**File:** `src/config/database.ts:5`
**Issue:** `rejectUnauthorized: false` disables TLS certificate verification for the database connection in production. While common for Heroku Postgres, it means MITM attacks on the database connection are possible.
**Impact:** Theoretical MITM on database traffic in compromised network environments.
**Fix:** If the CA cert is available (Heroku provides it), use `rejectUnauthorized: true` with the CA bundle.

---

### [INFO] reconcileCart can produce negative quantities silently

**File:** `src/utils/reconcileCart.ts:17-19`
**Issue:** The function filters out items with `quantity <= 0`, which is correct. But if a customer adds 1 item and removes 2, the net is -1, which is silently dropped. No validation or logging occurs.
**Impact:** An inconsistent cart state is silently ignored rather than flagged.
**Fix:** Log a warning when a net-negative line is encountered — it may indicate a sensor bug.

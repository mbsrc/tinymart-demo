# TinyMart — To-Do

Active backlog of bugs, improvements, and tech debt. Read at the start of every session.

---

## Critical

- **Double-close race condition on session close** — `src/routes/sessions.ts:165-167`
  The `status !== "open"` guard runs OUTSIDE the transaction. Two concurrent close requests
  both pass the guard and enter the transaction — double inventory deduction, double Stripe
  charge. Fix: `SELECT ... FOR UPDATE` lock or optimistic locking on Session.

- **Inventory deductions not atomic with session close** — `src/routes/sessions.ts:224-234`
  `adjustInventory()` opens its own transaction internally. If Stripe capture fails, the
  outer transaction rolls back but inventory is already permanently deducted. Fix: pass the
  outer transaction `t` into `adjustInventory()`.

- **No Stripe idempotency keys on payment calls** — `src/services/stripe.ts:28,35`
  `createPaymentIntent` and `capturePaymentIntent` retry up to 3 times without passing
  idempotency keys to Stripe. Network timeout + retry = duplicate charges. Fix: generate
  UUID-based idempotency key per call, use session/charge ID for captures.

- **Session marked "failed" when charge is deferred** — `src/routes/sessions.ts:263`
  When Stripe is down and `captureOrDefer()` returns `"deferred"`, session status becomes
  "failed" even though items were taken and charge is pending. Fix: add "deferred" status
  or use "closed" with `charged_at = null`.

## Should Fix

- **Health routes missing asyncHandler** — `src/routes/health.ts:24,60`
  `/health/ready` and `/health/detailed` are async but not wrapped. Rejected promises
  become unhandled rejections — client hangs, process may crash.

- **API keys stored in plaintext** — `src/models/Operator.ts:9`
  Database compromise exposes all keys. Fix: hash with SHA-256, display raw key only once.

- **/health/detailed exposes internals without auth** — `src/routes/health.ts:60-100`
  Leaks memory usage, uptime, circuit breaker states, queue internals. Gate behind auth
  or restrict to internal network.

- **deduct-inventory idempotency check — verify** — `src/jobs/handlers/deductInventory.ts:24-34`
  Originally flagged as checking for ANY deduction event, not per-product. However the
  code filters by `reference_id: sessionId` which may be sufficient. Needs review to
  confirm partial-deduction (crash after 2 of 3 products) is actually handled.

- **sendReceipt handler silently swallows failures** — `src/jobs/handlers/sendReceipt.ts:47-51`
  No try/catch, no `recordJobFailure`. After pg-boss retries exhaust, failure is invisible.

- **Separate connection pool for pg-boss** — `src/jobs/queue.ts:9-11`
  pg-boss creates its own pool (10 connections) + app pool (5) = 15+. Heroku basic allows
  20. Two dynos would hit the limit. Fix: pass `pool: { max: 3 }` to pg-boss config.

- **Products and stores list endpoints have no pagination** — `src/routes/products.ts:70`, `src/routes/stores.ts:33`
  `findAll` returns all records without LIMIT. Fix: add `limit`/`offset` params (default 50, max 100).

- **Missing input validation on numeric fields** — `src/routes/stores.ts:66,80-81`
  `quantity_on_hand` and `low_stock_threshold` pass through without type/range checks.
  Negative numbers bypass stock checks.

- **dependencyRegistry interval not unref'd** — `src/services/dependencyRegistry.ts:93`
  Keeps event loop alive during shutdown. Fix: add `.unref()` like the rate limiter does.

## Nice to Have

- **N+1 queries in session close cart detail lookup** — `src/routes/sessions.ts:189-219`
  Each cart line triggers a separate `StoreProduct.findOne`. Fix: batch into single
  `findAll` with `Op.in`.

- **Missing indexes on transactions.status and created_at** — migration `20260323000007`
  Transaction listing filters by status and orders by created_at, neither indexed.
  Add composite index on `(store_id, created_at DESC)`.

- **constructWebhookEvent throws raw Error** — `src/services/stripe.ts:51`
  Should throw `AppError` with `STRIPE_CONFIG_ERROR` code, not generic Error.

- **CORS defaults to wildcard** — `src/config/index.ts:34`
  Fine for dev, risky if forgotten in prod. Consider requiring explicit origins in production.

- **SSL rejectUnauthorized: false in production** — `src/config/database.ts:5`
  Disables TLS cert verification. Use Heroku's CA bundle if available.

- **reconcileCart can produce negative quantities silently** — `src/utils/reconcileCart.ts:17-19`
  Net-negative lines are silently dropped. Log a warning — may indicate a sensor bug.

---

## Load Tests (`load-tests/smoke.js`)

### Bugs

- **Idempotency replay status check is wrong** (`operatorFlow`, line 131)
  The replay check expects HTTP `200`, but the API returns `201` for cached creates.
  The `idempotencyHits` counter never increments.

- **Rate-limit burst pollutes read-traffic metrics** (`rateLimitBurst`, starts at 30s)
  Burst fires on the shared operator API key, exhausting the rate-limit window for
  concurrent `read_traffic` VUs. 429s are counted as `rateLimited` but not `apiErrors`,
  masking threshold failures. Use a dedicated key or schedule burst after reads end.

### Missing Coverage

- **No shopping session scenario**
  The core flow (open session -> add/remove items -> close -> charge) is not exercised.
  This is where payment auth, inventory decrement, and deferred charge logic run.

### Reliability

- **`operatorFlow` silently no-ops when no stores exist**
  Empty store list short-circuits the entire scenario. Fix: create a store at the top
  of the flow instead of depending on seeded data.

- **No think time between requests inside `operatorFlow`**
  5 back-to-back HTTP calls with no sleep between them (only `sleep(1)` at the end).
  Add pauses between steps for realistic operator think time.

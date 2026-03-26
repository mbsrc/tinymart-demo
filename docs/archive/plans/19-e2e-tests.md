# Plan 19: End-to-End Tests

## Goal
Add e2e tests that exercise the full TinyMart API through multi-step flows, validating that middleware, routes, services, and database work together correctly. Existing tests are per-feature unit/integration — these tests walk through complete user journeys.

## Design Decisions

### Test infrastructure
- Use Supertest against the Express `app` (same as existing tests — no live server needed)
- Run against `tinymart_test` database via `sequelize.sync({ force: true })` for isolation
- Add `tests/e2e/` directory to separate from unit/integration tests
- Add `test:e2e` script to `package.json`
- Each test file creates its own operator/data — no dependency on seeders

### What e2e tests add over existing tests
- **Multi-step flows**: create → use → verify, not just single-endpoint assertions
- **Cross-cutting concerns**: auth + idempotency + rate limiting interacting in one request
- **Data integrity across endpoints**: create via POST, verify via GET, modify via PATCH, verify event history
- **Operator isolation**: two operators in the same test, verifying they can't see each other's data

## Sub-steps

### 19a. Test infrastructure setup
- Create `tests/e2e/helpers.ts` with shared utilities:
  - `createOperator(name)` — creates operator, returns `{ operator, headers }` (with `x-api-key` and `Content-Type` pre-set)
  - `idemKey()` — returns `{ "Idempotency-Key": uuid }` for easy spreading into headers
- Add `test:e2e` script: `vitest run tests/e2e/`
- Ensure `fileParallelism: false` applies to e2e tests too

### 19b. Happy path: full inventory lifecycle
**File:** `tests/e2e/inventory-lifecycle.test.ts`

Scenarios:
1. **Product → Store → Restock → Deduct → Events**
   - Create a product (POST `/api/products`) → 201
   - Create a store (POST `/api/stores`) → 201
   - Add product to store with `quantity_on_hand: 0` (POST `/api/stores/:id/products`) → 201
   - Restock: PATCH quantity to 20 → 200, verify `quantity_on_hand: 20`
   - Deduct: PATCH quantity to 15 → 200, verify `quantity_on_hand: 15`
   - Get event history (GET `/api/stores/:id/products/:productId/events`) → 200
   - Verify 2 events: restock (+20) then adjustment (-5), correct versions (1, 2)
   - Verify event `store_product_id`, `event_type`, `quantity_delta` fields

2. **Multiple products in one store**
   - Create 3 products, add all to same store with different quantities
   - GET store detail → verify all 3 products with correct quantities
   - Adjust each independently, verify they don't interfere

3. **Insufficient stock guard**
   - Restock product to 5 units
   - PATCH to deduct 10 → 409 `INSUFFICIENT_STOCK`
   - Verify quantity is still 5 (unchanged)

4. **Optimistic lock conflict**
   - GET store product to read current version
   - PATCH with stale `version` → 409 `STALE_VERSION`

### 19c. Idempotency across the lifecycle
**File:** `tests/e2e/idempotency.test.ts`

Scenarios:
1. **Exact replay returns cached response**
   - POST create product with idempotency key → 201
   - POST same body + same key → 200 with identical `data`
   - Verify product only created once (GET list → count is 1)

2. **Body mismatch on same key**
   - POST create product with key "abc" → 201
   - POST different body with key "abc" → 422 `IDEMPOTENCY_BODY_MISMATCH`

3. **Idempotency across different endpoints**
   - POST create product with key "xyz" → 201
   - POST create store with same key "xyz" → 201 (different path = different cache entry)

4. **PATCH is also idempotent**
   - PATCH inventory update with key → 200
   - Replay same PATCH → 200 with cached response
   - Verify quantity only changed once

### 19d. Authentication and operator isolation
**File:** `tests/e2e/auth-isolation.test.ts`

Scenarios:
1. **No API key**
   - GET `/api/stores` without `x-api-key` → 401
   - POST `/api/products` without `x-api-key` → 401

2. **Invalid API key**
   - GET `/api/stores` with `x-api-key: bogus` → 401

3. **Operator A cannot see Operator B's resources**
   - Operator A creates product + store
   - Operator B creates product + store
   - Operator A lists stores → sees only their own
   - Operator A lists products → sees only their own
   - Operator A GET store B's ID → 404 (not 403)
   - Operator A POST product to store B → 404
   - Operator A cannot add Operator B's product to their own store

4. **Operator B cannot access Operator A's inventory events**
   - Operator A creates product, adds to store, restocks
   - Operator B GET events for A's store product → 404

### 19e. Rate limiting under realistic traffic
**File:** `tests/e2e/rate-limiting.test.ts`

Scenarios:
1. **Burst past the limit**
   - Configure test with low limit (e.g., 10 requests per 60s window)
   - Send 10 GET requests → all 200
   - Send 11th → 429 with `Retry-After` header
   - Verify `X-RateLimit-Remaining` decrements correctly across requests

2. **Rate limit is per API key**
   - Operator A exhausts their limit (429)
   - Operator B still gets 200 (independent window)

3. **Health endpoints bypass rate limiter**
   - Exhaust rate limit for an operator
   - GET `/health` → still 200 (no auth, no rate limit)

### 19f. Health and diagnostics
**File:** `tests/e2e/health.test.ts`

Scenarios:
1. **Liveness is always 200**
   - GET `/health` → 200, `data.status === "ok"`

2. **Readiness reports dependencies**
   - GET `/health/ready` → 200, `data.status === "ready"`
   - Verify `data.checks` contains `database`, `stripe`, `job_queue`

3. **Detailed diagnostics**
   - GET `/health/detailed` → 200
   - Verify response contains: `circuit_breakers`, `dependencies`, `uptime`, `memory`
   - Verify `uptime` is a positive number
   - Verify `memory.rss` and `memory.heap_used` are positive numbers

4. **Correlation ID round-trip**
   - Send request with `X-Correlation-ID: test-123`
   - Verify response header `X-Correlation-ID: test-123`
   - Verify response body `meta.correlation_id === "test-123"`
   - Send request without header → auto-generated UUID in response

5. **404 returns proper envelope**
   - GET `/api/nonexistent` → 404 with `{ success: false, error: { code: "NOT_FOUND" } }`

### 19g. Response envelope consistency
**File:** `tests/e2e/envelope.test.ts`

Scenarios:
1. **All success responses have correct envelope shape**
   - Sample across GET, POST, PATCH endpoints
   - Verify every response has: `success: true`, `data` (object or array), `error: null`, `meta.correlation_id`, `meta.timestamp`

2. **All error responses have correct envelope shape**
   - Sample: 400 (validation), 401 (auth), 404 (not found), 409 (conflict), 429 (rate limit)
   - Verify every response has: `success: false`, `data: null`, `error.code` (string), `error.message` (string), `meta.correlation_id`, `meta.timestamp`

3. **Timestamps are valid ISO 8601**
   - Verify `meta.timestamp` parses as a valid date on every response

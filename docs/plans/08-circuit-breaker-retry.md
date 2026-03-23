# Plan: Phase 2 Step 8 — Circuit Breaker + Retry Utilities

**Status**: Complete
**Commit**: `3052d0a` on `develop`

## Context

Step 7 (idempotency middleware) is complete. Step 8 adds resilience around external calls (Stripe) with two complementary patterns. Maps to PRD requirements:
- **R2**: Circuit breaker on Stripe calls — prevent cascading failures
- **R3**: Retry with exponential backoff + jitter — safe retry logic

---

## Files Created

| File | Purpose |
|------|---------|
| `src/utils/circuitBreaker.ts` | Generic `CircuitBreaker` class with CLOSED/OPEN/HALF_OPEN states |
| `src/utils/retry.ts` | `retryWithBackoff` utility + `isRetryableStripeError` predicate |
| `src/services/stripe.ts` | Stripe client wrapped with circuit breaker + retry |
| `tests/circuitBreaker.test.ts` | 11 unit tests for circuit breaker |
| `tests/retry.test.ts` | 14 unit tests for retry + Stripe error classification |

## Files Modified

| File | Change |
|------|--------|
| `src/routes/health.ts` | Added `circuit_breakers.stripe` to `/health/detailed` |
| `docs/progress.md` | Checked off step 8 |

---

## Implementation Details

### 8a: Circuit Breaker (`src/utils/circuitBreaker.ts`)

Generic `CircuitBreaker` class, not Stripe-specific — reusable for any external dependency.

- **Three states**: CLOSED (normal) → OPEN (fail-fast after N failures) → HALF_OPEN (probe with limited requests) → CLOSED
- **Config**: `failureThreshold` (default 5), `resetTimeoutMs` (default 30s), `halfOpenMaxAttempts` (default 1). Only `name` is required; rest have defaults via `DEFAULTS` constant.
- **Interface**: `execute<T>(fn: () => Promise<T>): Promise<T>` — wraps any async call
- **State tracking**: `failureCount`, `lastFailureTime`, `halfOpenAttempts`, `state`
- **Logging**: Logs state transitions via `logger.info()` with `from`, `to`, and `failure_count` context
- **Error**: Throws `AppError(503, "CIRCUIT_OPEN", ...)` when circuit is open or half-open attempts are exhausted
- **Status**: `getStatus()` returns `CircuitBreakerStatus` with state, failure count, last failure time, and next retry time
- **Reset behavior**: Success in half-open transitions to closed and resets counters. Success in closed resets failure count. Failure in half-open immediately transitions back to open.

### 8b: Retry with Backoff (`src/utils/retry.ts`)

Generic retry utility, composable with circuit breaker.

- **Exponential backoff**: `delay = baseDelayMs * 2^attempt` (e.g. 100ms, 200ms, 400ms)
- **Random jitter**: ±25% via `addJitter()` — prevents thundering herd
- **Config**: `maxRetries` (default 3), `baseDelayMs` (default 100), `shouldRetry` predicate (default: always retry)
- **Loop**: `for (attempt = 0; attempt <= maxRetries)` — initial call + N retries
- **Retry logic**: Logs each retry with attempt number, delay, and error message via `logger.warn()`
- **`isRetryableStripeError()`**: Exported predicate — checks `statusCode` property (>=500 → retry, <500 → don't), `code` property starting with "E" for network errors (ECONNREFUSED, ETIMEDOUT), defaults to retry for unknown errors

### 8c: Stripe Service Wrapper (`src/services/stripe.ts`)

- **Client**: `new Stripe(config.stripeSecretKey)` — initialized at module level
- **Circuit breaker**: Single `stripeCircuitBreaker` instance exported for health endpoint access
- **Composition**: `resilientCall()` helper — `circuitBreaker.execute(() => retryWithBackoff(fn, { shouldRetry: isRetryableStripeError }))`
- **Methods**: `createPaymentIntent()`, `capturePaymentIntent()`, `cancelPaymentIntent()` — all wrapped with `resilientCall()`
- **Webhook**: `constructWebhookEvent()` — NOT wrapped (signature verification is synchronous and local)
- **Discovery**: No Stripe API calls existed prior to this step — the service layer was built from scratch

### 8d: Health Endpoint Integration

`/health/detailed` now returns `circuit_breakers.stripe` with `CircuitBreakerStatus`:
```json
{
  "circuit_breakers": {
    "stripe": {
      "state": "closed",
      "failureCount": 0,
      "lastFailureTime": null,
      "nextRetryTime": null
    }
  }
}
```

### 8e: Tests

**`tests/circuitBreaker.test.ts`** (11 tests):
- Starts in closed state, passes through successful calls
- Stays closed below threshold, opens at threshold
- Rejects immediately when open (verifies fn not called, checks AppError code/status)
- Transitions to half_open after reset timeout (uses `vi.useFakeTimers()`)
- Returns to open if half_open probe fails
- Resets failure count after successful call in closed state
- Limits half_open attempts
- `getStatus()` returns correct details in closed and open states

**`tests/retry.test.ts`** (14 tests):
- Returns on first success, retries and recovers, exhausts max retries
- Honors `shouldRetry: () => false`
- Verifies increasing delays between retries (real timing, small baseDelay)
- `isRetryableStripeError`: 500/502 → true, 400/402/404 → false, ECONNREFUSED/ETIMEDOUT → true, unknown errors → true, non-Error values → true

---

## Verification Results

1. `bun run test` — 75 tests pass (25 new)
2. `bun lint` — clean (after auto-fix of 3 formatting issues)
3. `/health/detailed` — returns `circuit_breakers.stripe` status

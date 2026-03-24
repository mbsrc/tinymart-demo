# Plan: Phase 2 Step 11 — Rate Limiting

**Status**: Complete

## Context

Steps 7-10 added idempotency, circuit breaker, background jobs, and inventory event sourcing. Step 11 adds rate limiting to protect the API from abuse. The middleware slot (position 6) was pre-reserved in `app.ts`, and config values (`rateLimitWindowMs`, `rateLimitMaxRequests`) were already defined.

## Files Created

| File | Purpose |
|------|---------|
| `src/middleware/rateLimiter.ts` | Sliding window rate limiter middleware |
| `tests/rateLimiter.test.ts` | 6 integration tests |
| `docs/plans/11-rate-limiting.md` | This plan |

## Files Modified

| File | Change |
|------|--------|
| `src/app.ts` | Wired rate limiter at middleware slot 6 |
| `docs/progress.md` | Checked off step 11 |

## Implementation Details

### Rate Limiter (`src/middleware/rateLimiter.ts`)

- **Algorithm**: Sliding window counter — tracks request timestamps per client, drops entries older than the window
- **Client key**: `x-api-key` header if present, falls back to IP address
- **Config**: `RATE_LIMIT_WINDOW_MS` (default 60000) and `RATE_LIMIT_MAX_REQUESTS` (default 100), from `src/config/index.ts`
- **Response on 429**: Standard error envelope with `RATE_LIMIT_EXCEEDED` code and `retry_after` seconds
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` (on 429)
- **Cleanup**: Background interval (every 5 min, `unref`'d) prunes stale entries to prevent memory leaks
- **Placement**: After health routes (slot 6) so monitors aren't throttled

No external dependency — custom implementation for the demo.

### Tests (`tests/rateLimiter.test.ts`)

1. **allows requests under the limit** — single request returns 200 with rate limit headers
2. **returns rate limit headers on every response** — verifies `X-RateLimit-Limit` and `X-RateLimit-Remaining`
3. **returns 429 when limit is exceeded** — 101 requests, 100 succeed, 1 gets 429
4. **returns proper error envelope on 429** — verifies error code, retry_after, and headers
5. **does not rate limit health endpoints** — health returns 200 even after API limit hit
6. **tracks limits per API key independently** — one key limited, other key still works

## Verification Results

1. `bun run lint` — clean (68 files)
2. `bun run test` — 98 tests pass (6 new), 11 test files

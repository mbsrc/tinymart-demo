---
paths:
  - "src/**/*.ts"
  - "tests/**/*.ts"
  - "load-tests/**"
---

# Backend Rules

## API Patterns
- All responses use envelope: `{ success, data, error, meta }`
- Helpers: `envelope()` / `errorEnvelope()` from `src/utils/envelope.ts`
- Errors: throw `AppError` from `src/types/index.ts` — never raw `Error`
- Async handlers: Express 5 catches async errors natively — no wrapper needed

## Middleware Order (`src/app.ts`)
1. `helmet` → 2. `trust proxy` → 3. `cors` → 4. body parsers
5. `correlationId` → 6. `requestLogger` → 7. health routes (before rate limiter)
8. `rateLimiter` → 9. `degradation` → 10. API routes
11. `notFound` (3-arg) → 12. `errorHandler` (4-arg, always last)

## Stripe (`src/services/stripe.ts`)
- All calls wrapped in circuit breaker (`src/utils/circuitBreaker.ts`)
- Retry with exponential backoff + jitter for 5xx/network errors, no retry for 4xx (`src/utils/retry.ts`)
- Test files mock Stripe with `vi.mock()` — never call real Stripe in tests

## Background Jobs (`src/jobs/`)
- pg-boss for async workflows: `src/jobs/queue.ts`, `src/jobs/safeEnqueue.ts`
- Jobs must be idempotent (safe to retry)
- Failed jobs go to dead letter table via `recordJobFailure`

## Testing (`tests/`)
-  PostgreSQL on port **5432**
- `tests/setup.ts` sets `DATABASE_URL`, `STRIPE_SECRET_KEY`, and `PORT=0`
- `fileParallelism: false` in `vitest.config.ts` — never change this (prevents Sequelize OID errors)
- Shared helpers (`createOperator`, `idemKey`) in `tests/helpers.ts`
- Tables must be cleaned in dependency order in `beforeEach`
- Run: `bun run test` (full) or `bunx vitest run tests/<file>.test.ts` (single)
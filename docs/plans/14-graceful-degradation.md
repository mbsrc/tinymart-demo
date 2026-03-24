# Plan 14: Graceful Degradation

## Goal
When external dependencies (Stripe, pg-boss) are unavailable, the app should continue serving requests in a reduced capacity rather than failing hard. Customers can still browse; payments and async jobs get deferred until the dependency recovers.

## Current State
- **Circuit breaker** wraps Stripe calls — opens after 5 failures, throws `AppError(503)` immediately
- **pg-boss job queue** — singleton via `getJobQueue()`, returns `null` if not started
- **Health endpoints** — already report DB, job queue, and Stripe circuit breaker status
- **Graceful shutdown** — SIGTERM/SIGINT handlers in `server.ts`
- **No route currently calls Stripe or enqueues jobs** — session/transaction routes are not yet wired up, so the degradation layer prepares the plumbing for those future routes

## Design Decisions
1. **Central dependency registry** over scattered health checks — single source of truth for "what's up, what's down"
2. **Fallback to database queue** when pg-boss is unavailable — pending jobs table acts as overflow, replayed on recovery
3. **Deferred charging** when Stripe circuit is open — record intent in DB, process when circuit closes
4. **Read-only endpoints stay fully available** — degradation only affects write paths that touch external services
5. **Health endpoints reflect degradation** — `/health/ready` reports `degraded` with detail on what's reduced

## Sub-steps

### 14a. Dependency registry (`src/services/dependencyRegistry.ts`)
Central singleton that tracks health of each external dependency. Integrates with the existing circuit breaker and job queue.

- `DependencyStatus`: `"healthy" | "degraded" | "unavailable"`
- `DependencyRegistry` class with:
  - `register(name, healthCheckFn)` — registers a dependency with its health check
  - `getStatus(name)` — returns current status for one dependency
  - `getAllStatuses()` — returns map of all dependency statuses
  - `isHealthy(name)` — boolean convenience
  - `startMonitoring(intervalMs)` / `stopMonitoring()` — periodic background checks
- Register three dependencies on startup:
  - **database** — `sequelize.authenticate()`
  - **stripe** — reads `stripeCircuitBreaker.getState()` (closed=healthy, half_open=degraded, open=unavailable)
  - **job_queue** — checks `getJobQueue() !== null` + pg-boss connection status

### 14b. Safe job enqueue helper (`src/jobs/safeEnqueue.ts`)
Wrapper around `boss.send()` that falls back to a `pending_jobs` database table when pg-boss is unavailable.

- New migration: `pending_jobs` table (`id`, `queue_name`, `payload`, `created_at`, `processed_at`)
- New model: `PendingJob`
- `safeEnqueue(queueName, payload)`:
  1. Try `getJobQueue()?.send(queueName, payload)`
  2. If boss is null or send throws → insert into `pending_jobs`
  3. Log which path was taken
- `replayPendingJobs()`:
  - Called periodically (or on job queue recovery) to drain `pending_jobs` into pg-boss
  - Marks rows as processed
  - Register as a pg-boss cron job (runs every 5 minutes when queue is healthy)

### 14c. Deferred Stripe charging (`src/services/deferredCharge.ts`)
When the Stripe circuit breaker is open, record the payment intent in DB for later processing.

- New migration: `deferred_charges` table (`id`, `session_id`, `amount`, `currency`, `stripe_params`, `status`, `attempts`, `last_error`, `created_at`, `processed_at`)
- New model: `DeferredCharge`
- `chargeOrDefer(params)`:
  1. Check `stripeCircuitBreaker.getState()`
  2. If closed/half_open → call `createPaymentIntent(params)` as normal
  3. If open → insert into `deferred_charges` with status `pending`, return a response indicating deferred
- `processDeferredCharges()`:
  - Job handler that retries pending deferred charges when Stripe recovers
  - Updates status to `succeeded` or increments `attempts`
  - Register as a pg-boss cron job (runs every 2 minutes)

### 14d. Degradation-aware middleware (`src/middleware/degradation.ts`)
Express middleware that attaches dependency status to each request so route handlers can make informed decisions.

- Reads from the dependency registry (no network calls per-request — registry caches status)
- Attaches `req.degradation` with:
  - `stripe: DependencyStatus`
  - `jobQueue: DependencyStatus`
  - `database: DependencyStatus`
- Extend Express `Request` type in `src/types/index.ts`
- Insert in middleware chain after rate limiter, before API routes

### 14e. Update health endpoints + tests
- Refactor `/health/ready` and `/health/detailed` to use the dependency registry instead of inline checks
- `/health/ready` returns 200 with `status: "degraded"` when non-critical deps are down (Stripe, job queue) but DB is up
- `/health/detailed` includes `degradation` section showing registry output
- Add Vitest tests for the dependency registry, safe enqueue, deferred charges, and degradation middleware

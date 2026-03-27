# Plan: Phase 2 Step 9 — Background Jobs (pg-boss)

**Status**: Complete
**Commit**: `3387497` on `develop`

## Context

Steps 7-8 are complete. Step 9 adds pg-boss for resilient async workflows. Maps to PRD requirement:
- **R4**: Background jobs — hardened async workflows with dead letter tracking

---

## Files Created

| File | Purpose |
|------|---------|
| `src/jobs/queue.ts` | pg-boss initialization, start/stop, singleton accessor |
| `src/jobs/handlers/index.ts` | Handler registration + schedule setup |
| `src/jobs/handlers/sendReceipt.ts` | Receipt notification handler + `recordJobFailure` dead letter utility |
| `src/jobs/handlers/cleanupIdempotencyKeys.ts` | Hourly cleanup of expired idempotency keys |
| `src/migrations/20260323000009-create-job-failures.ts` | Dead letter table migration |
| `src/models/JobFailure.ts` | Sequelize model for `job_failures` table |
| `tests/jobs.test.ts` | 5 integration tests for job handlers |

## Files Modified

| File | Change |
|------|--------|
| `src/models/index.ts` | Added `JobFailure` import, model registration, and export |
| `src/routes/health.ts` | Added `job_queue` section to `/health/detailed` |
| `src/server.ts` | Added job queue startup on listen, graceful shutdown on SIGTERM/SIGINT |
| `docs/progress.md` | Checked off step 9 |
| `package.json` | Added `pg-boss@12.14.0` dependency |

---

## Implementation Details

### 9a: pg-boss Queue (`src/jobs/queue.ts`)

- **Package**: `pg-boss@12.14.0` (named export: `import { PgBoss } from "pg-boss"`)
- **Init**: `new PgBoss({ connectionString: config.databaseUrl, retryLimit: 3, retryDelay: 5, retryBackoff: true, ... })`
- **Lifecycle**: `startJobQueue()` starts boss + registers handlers, `stopJobQueue()` does graceful stop with 10s timeout
- **Singleton**: `getJobQueue()` returns current instance or null (used by health endpoint)
- **Error handling**: `boss.on("error", ...)` logs via `logger.error()`
- **Schema**: pg-boss auto-creates its own `pgboss.*` schema tables on first start

### 9b: Dead Letter Table

**Migration** `20260323000009-create-job-failures.ts`:
- `id` UUID PK, `job_name` STRING(100) indexed, `payload` JSONB, `error_message` TEXT, `attempts` INTEGER, `last_attempted_at` DATE, `created_at` DATE
- No `updated_at` — rows are write-once
- Wrapped in transaction per project convention

**Model** `src/models/JobFailure.ts`:
- Class-based with `Model.init()` / `Model.associate()` pattern
- `timestamps: true, updatedAt: false`
- Standalone table (empty `associate()`)

### 9c: Receipt Notification Job (`src/jobs/handlers/sendReceipt.ts`)

- **Job name**: `send-receipt`
- **Handler signature**: `(jobs: Job<SendReceiptPayload>[]) => Promise<void>` — pg-boss v12 passes arrays
- **Payload type**: `SendReceiptPayload { sessionId: string, transactionId: string }`
- **Logic per job**: Delegates to `processReceipt()` which:
  1. Looks up transaction by ID — skips if not found (warn log)
  2. Checks `transaction.status === "succeeded"` — skips if not (idempotent guard)
  3. Fetches session with `SessionItems` included
  4. Logs "Receipt sent" with transaction details (demo — no real email)
- **`recordJobFailure()`**: Exported utility for writing to `job_failures` table with error context. Catches its own errors to avoid masking the original failure.

### 9d: Idempotency Key Cleanup (`src/jobs/handlers/cleanupIdempotencyKeys.ts`)

- **Job name**: `cleanup-expired-idempotency-keys`
- **Schedule**: `"0 * * * *"` (hourly) via `boss.schedule()` in handler registration
- **Logic**: `IdempotencyKey.destroy({ where: { expires_at: { [Op.lt]: new Date() } } })`
- **Logging**: Logs `deleted_count` after each run
- Completes the deferred cleanup from step 7

### 9e: Session Close Integration

**Deferred** — session routes don't exist yet. The `send-receipt` handler and Stripe service are ready to be wired in when the shopping session API is built. The flow will be:
1. Capture Stripe payment via `capturePaymentIntent()` (circuit breaker from step 8)
2. Create transaction record
3. `boss.send("send-receipt", { sessionId, transactionId })`

### 9f: Health Endpoint Integration

`/health/detailed` now returns `job_queue` section:
- When queue is running: `{ status: "running", queues: [...], dead_letter_count: N }`
- When queue hasn't started: `{ status: "not_started" }`
- On error querying: `{ status: "error" }`

Uses `getJobQueue()` to check if boss is initialized, and `boss.getQueues()` for queue info.

### 9g: Server Lifecycle (`src/server.ts`)

- **Startup**: After `app.listen()`, calls `startJobQueue()` with error handling (logs but doesn't crash if queue fails to start)
- **Shutdown**: `SIGTERM` and `SIGINT` handlers call `server.close()` then `stopJobQueue()`, with 15s force-exit timeout
- Previous server.ts was a simple 3-line file — now handles full lifecycle

---

## Tests (`tests/jobs.test.ts`)

5 integration tests against the real test database:

1. **send-receipt: logs receipt for succeeded transaction** — Creates succeeded transaction, verifies "Receipt sent" appears in stdout with transaction ID
2. **send-receipt: skips transaction not in succeeded state** — Creates pending transaction, verifies skip log and no receipt log
3. **send-receipt: skips if transaction not found** — Passes nonexistent ID, verifies "transaction not found" warning
4. **recordJobFailure: writes to job_failures table** — Calls utility, verifies row in `job_failures` with correct error message, attempts, and payload
5. **cleanup: deletes expired keys** — Creates one expired and one valid idempotency key, runs handler, verifies only expired key was deleted

**Test helper**: `makeJob<T>(data)` constructs a `Job<T>[]` array with required pg-boss fields (id, name, signal, etc.)

---

## Verification Results

1. `bun run test` — 75 tests pass (5 new)
2. `bun lint` — clean (after auto-fix of 2 formatting issues)
3. `bun db:migrate` — `job_failures` table created successfully
4. `/health/detailed` — returns `job_queue` status
5. Session close integration — deferred until session routes are built

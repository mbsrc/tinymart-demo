# Plan: Phase 2 Step 7 — Idempotency Middleware

## Context

TinyMart Phase 1 (V1) is complete. Phase 2 hardens reliability. Step 7 adds HTTP-level idempotency to all mutation endpoints (POST/PATCH/DELETE) so that retried requests return cached responses instead of re-executing. This maps to the Micromart JD requirement: "Design and implement resilient patterns including idempotency."

The project already has domain-level `idempotency_key` columns on Session and Transaction models. This middleware operates at the HTTP layer — complementary, not overlapping.

---

## Design Decisions

1. **Middleware placement**: After `authenticateOperator`, before route handlers — unauthenticated requests never touch idempotency logic
2. **Selective by method**: Middleware checks `req.method` internally — skips GET/HEAD/OPTIONS, enforces on POST/PATCH/DELETE
3. **Body hashing**: SHA-256 of recursively key-sorted JSON for deterministic comparison regardless of key order
4. **Response capture**: Monkey-patch `res.json()` to intercept and cache the response after the route handler runs
5. **Concurrency**: Unique constraint on `key` PK — second concurrent insert gets `SequelizeUniqueConstraintError` → 409
6. **Caching policy**: Cache 2xx and 4xx responses; delete in-progress record on 5xx so client can retry
7. **Expiry**: 24-hour TTL, lazy filtering via `WHERE expires_at > NOW()` (periodic cleanup deferred to step 9: pg-boss)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/utils/hashBody.ts` | Stable JSON hashing utility (SHA-256, sorted keys) |
| `src/migrations/20260323000008-create-idempotency-keys.ts` | Migration: `idempotency_keys` table |
| `src/models/IdempotencyKey.ts` | Sequelize model (follows Transaction.ts pattern) |
| `src/middleware/idempotency.ts` | Core middleware |
| `tests/idempotency.test.ts` | Integration tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/models/index.ts` | Import + register `IdempotencyKey` in models object |
| `src/types/index.ts` | Add `idempotencyKey?: string` to Express Request augmentation |
| `src/app.ts` | Add `idempotency` middleware to API route chains |
| `docs/progress.md` | Check off item 7 |

---

## Implementation Steps

### Step 1: `src/utils/hashBody.ts`
Pure utility, no dependencies. Recursive `stableStringify` that sorts object keys, then SHA-256 hash. Returns 64-char hex string.

### Step 2: Migration `20260323000008-create-idempotency-keys.ts`
Table schema per PRD:
- `key` — STRING(255), PK
- `request_path` — STRING(500), not null
- `request_body_hash` — STRING(64), not null
- `response_status` — INTEGER, nullable (null = in-progress)
- `response_body` — JSONB, nullable (null = in-progress)
- `created_at` — DATE, not null
- `expires_at` — DATE, not null, indexed

No `updated_at` — rows are write-once then one update to fill response. Wrapped in transaction per project convention.

### Step 3: `src/models/IdempotencyKey.ts`
Class-based model following Transaction.ts pattern exactly:
- `IdempotencyKeyAttributes` / `IdempotencyKeyCreationAttributes` interfaces
- `declare` fields, `static initialize()`, `static associate()` (empty — standalone table)
- `timestamps: true, updatedAt: false` for auto `created_at` without `updated_at`
- `underscored: true`, `tableName: "idempotency_keys"`

### Step 4: `src/models/index.ts`
Add import, include in models object, add to exports.

### Step 5: `src/types/index.ts`
Add `idempotencyKey?: string` to the Express Request augmentation.

### Step 6: `src/middleware/idempotency.ts`
Core logic (async function with try/catch + `next(error)` per auth.ts pattern):

1. Skip if `req.method` is in `GET/HEAD/OPTIONS`
2. Extract `Idempotency-Key` header → 400 if missing
3. Validate key length ≤ 255 chars
4. Compute body hash via `hashBody(req.body)`
5. Build `requestPath` = `${req.method} ${req.baseUrl}${req.path}`
6. Lookup existing non-expired key in DB
7. If found:
   - Body hash mismatch → 422 `IDEMPOTENCY_BODY_MISMATCH`
   - Path mismatch → 422 `IDEMPOTENCY_PATH_MISMATCH`
   - Response null (in-progress) → 409 `IDEMPOTENCY_KEY_IN_PROGRESS`
   - Otherwise → replay cached response
8. If not found: insert in-progress record (catch unique constraint → 409)
9. Monkey-patch `res.json()`:
   - On < 500: update row with `response_status` and `response_body`
   - On ≥ 500: destroy the row so the request can be retried
10. Set `req.idempotencyKey = key`, call `next()`

### Step 7: `src/app.ts`
Wire middleware into route chains after authenticateOperator.

### Step 8: `tests/idempotency.test.ts`
Integration tests covering: missing header, GET passthrough, replay, body mismatch, path mismatch, expiry, cached errors, key ordering.

### Step 9: Update `docs/progress.md`
Check off `[x] 7. Idempotency middleware`

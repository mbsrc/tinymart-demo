# Plan: Phase 2 Step 10 — Inventory Event Sourcing + Optimistic Locking

**Status**: In Progress

## Context

Steps 7-9 added idempotency, circuit breaker, and background jobs. Step 10 introduces event sourcing for inventory mutations and optimistic locking to prevent lost updates from concurrent sessions. Currently `StoreProduct.quantity_on_hand` is updated via direct `.save()` with no concurrency protection, no audit trail, and no inventory deduction logic on charge.

This step adds:
- An append-only `inventory_events` table (event log)
- A `version` column on `store_products` (optimistic lock)
- An `InventoryService` that coordinates both
- A `deduct-inventory` background job for post-charge inventory deduction
- An event history API endpoint

---

## Files Created

| File | Purpose |
|------|---------|
| `src/migrations/20260323000010-add-version-to-store-products.ts` | Add `version` column to `store_products` |
| `src/migrations/20260323000011-create-inventory-events.ts` | Create `inventory_events` table |
| `src/models/InventoryEvent.ts` | Append-only event model |
| `src/services/inventory.ts` | Core `adjustInventory()` + `getEventHistory()` |
| `src/jobs/handlers/deductInventory.ts` | Post-charge inventory deduction job |
| `tests/inventory.test.ts` | Service tests (optimistic lock, insufficient stock, etc.) |
| `tests/inventory-job.test.ts` | Deduct-inventory job handler tests |
| `docs/plans/10-inventory-event-sourcing.md` | This plan (committed copy) |

## Files Modified

| File | Change |
|------|--------|
| `src/models/StoreProduct.ts` | Add `version` field, `hasMany(InventoryEvent)` association |
| `src/models/index.ts` | Register `InventoryEvent` model |
| `src/jobs/handlers/index.ts` | Register `deduct-inventory` handler |
| `src/routes/stores.ts` | Rewire PATCH to use inventory service, add GET events endpoint |
| `docs/progress.md` | Check off step 10 |

---

## Implementation Details

### 10a: Migration — Add `version` to `store_products`

**File**: `src/migrations/20260323000010-add-version-to-store-products.ts`

- `addColumn("store_products", "version", { type: INTEGER, allowNull: false, defaultValue: 0 })`
- Down: `removeColumn("store_products", "version")`
- Wrapped in transaction per convention

**Also update** `src/models/StoreProduct.ts`:
- Add `version: number` to attributes interface + class declares
- Add to `Model.init()`: `version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }`
- Add to `StoreProductCreationAttributes` Omit list (has default)

### 10b: Migration — Create `inventory_events` table

**File**: `src/migrations/20260323000011-create-inventory-events.ts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `UUIDV4` |
| `store_product_id` | UUID FK | → `store_products.id`, CASCADE |
| `event_type` | ENUM | `restock`, `reserve`, `release`, `deduct`, `adjustment` |
| `quantity` | INTEGER | Delta (positive = add, negative = subtract) |
| `version` | INTEGER | Sequential per aggregate, matches StoreProduct version |
| `reference_id` | UUID | Nullable — links to session_id or other source |
| `reference_type` | STRING(50) | Nullable — e.g. `"session"`, `"manual"` |
| `metadata` | JSONB | Nullable |
| `created_at` | DATE | Write-once, no `updated_at` |

Indexes:
- `(store_product_id, version)` — UNIQUE, enforces event ordering
- `(reference_id, reference_type)` — for idempotency lookups

Down: drop table + ENUM type.

### 10c: InventoryEvent Model

**File**: `src/models/InventoryEvent.ts`

- Write-once: `timestamps: true, updatedAt: false` (follows `JobFailure` pattern)
- Export `InventoryEventType` union: `"restock" | "reserve" | "release" | "deduct" | "adjustment"`
- Association: `belongsTo(StoreProduct)`
- On `StoreProduct`: add `hasMany(InventoryEvent)` in `associate()`
- Register in `src/models/index.ts`

### 10d: Inventory Service

**File**: `src/services/inventory.ts`

#### `adjustInventory(params): Promise<InventoryEvent>`

```
1. Determine delta sign: restock/release → +quantity, reserve/deduct → -quantity
2. Start sequelize.transaction()
3. Read StoreProduct by ID → 404 if not found
4. Validate: for reserve/deduct, check quantity_on_hand + delta >= 0
   → AppError(409, "INSUFFICIENT_STOCK") if violated
5. Raw UPDATE with optimistic lock:
   UPDATE store_products
   SET quantity_on_hand = quantity_on_hand + :delta,
       version = version + 1, updated_at = NOW()
   WHERE id = :id AND version = :currentVersion
6. Check rowCount — if 0 → AppError(409, "STALE_VERSION")
7. Create InventoryEvent with version = currentVersion + 1
8. Commit + return event
```

Why raw SQL for the UPDATE: Sequelize ORM doesn't support `WHERE version = ?` on updates. This is an approved use of raw SQL per project database rules (performance-critical path with explanatory comment).

No retry inside the service — `STALE_VERSION` propagates to caller. API routes return 409 (client retries). Background jobs get pg-boss retries (3 attempts already configured).

#### `getEventHistory(storeProductId, { limit?, offset? }): Promise<{ events, total }>`

`InventoryEvent.findAndCountAll()` ordered by `version DESC` with pagination. Default limit 50, max 100.

### 10e: Background Job — `deduct-inventory`

**File**: `src/jobs/handlers/deductInventory.ts`

Payload: `{ sessionId: string }`

Logic per job:
1. Find Session by ID → skip if not found
2. **Idempotency**: check if `InventoryEvent` exists with `reference_id = sessionId, reference_type = "session", event_type = "deduct"` → skip if found
3. Query SessionItems for this session
4. Compute net quantities per product: group by `product_id`, `added` = +1, `removed` = -1, filter net > 0
5. For each product: find StoreProduct, call `adjustInventory({ eventType: "deduct", quantity: net, referenceId: sessionId, referenceType: "session" })`
6. On failure: `recordJobFailure()` + re-throw for pg-boss retry

Register in `src/jobs/handlers/index.ts`: `boss.work("deduct-inventory", handleDeductInventory)`

### 10f: Wire into Existing Routes

**Modify PATCH** `/:id/products/:productId` in `src/routes/stores.ts` (lines 95-122):
- If `quantity_on_hand` provided, compute delta from current value
- delta > 0 → `adjustInventory({ eventType: "restock", quantity: delta })`
- delta < 0 → `adjustInventory({ eventType: "adjustment", quantity: Math.abs(delta) })` (service negates)
- delta === 0 → skip
- `low_stock_threshold` still uses direct `.save()` (no event needed)
- Re-read StoreProduct after adjustment to return fresh data

**Add GET** `/:id/products/:productId/events`:
- Validate store ownership (same pattern as PATCH)
- Find StoreProduct
- Call `getEventHistory()` with `?limit=` and `?offset=` query params
- Return `envelope({ events, total }, buildMeta(req))`

### 10g: Tests

**`tests/inventory.test.ts`** — Service tests:
1. Restock increases quantity and creates event with correct version
2. Deduct decreases quantity
3. Insufficient stock throws `INSUFFICIENT_STOCK` (409)
4. Optimistic lock conflict throws `STALE_VERSION` (409) — manually bump version to simulate concurrent write
5. Event versions are sequential (1, 2, 3...)
6. `getEventHistory` returns paginated results with total

**`tests/inventory-job.test.ts`** — Job handler tests:
1. Deducts inventory for session items (2 added, 1 removed → net 1 deducted)
2. Idempotent: second run skips, no duplicate events
3. Skips if session not found
4. Handles multiple products in one session

Use `makeJob<T>()` helper pattern from `tests/jobs.test.ts`.

---

## Execution Order

1. **10a** — version migration + StoreProduct model update
2. **10b** — inventory_events migration
3. **10c** — InventoryEvent model + register
4. **10d** — Inventory service
5. **10e** — deduct-inventory job handler + register
6. **10f** — Rewire PATCH route + add GET events endpoint
7. **10g** — Tests
8. Run `bun lint:fix` + `bun test` after each sub-step

---

## Verification

1. `bun db:migrate` — both new migrations apply cleanly
2. `bun lint` — clean
3. `bun test` — all existing + new tests pass
4. Manual: PATCH a store product's `quantity_on_hand`, verify inventory event is created
5. Manual: GET event history endpoint returns paginated events
6. Manual: Simulate optimistic lock conflict (two rapid PATCHes) → second gets 409

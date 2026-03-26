# Operator Flows — End-to-End Reference

All operator-facing functionality: authentication, store management, product catalog, inventory control, transaction history, and system health monitoring.

## Overview

```
Authenticate → Manage Stores → Manage Products → Stock Inventory → Monitor Transactions → Check Health
```

All operator endpoints require an `x-api-key` header. The API key identifies the operator and scopes all queries to their stores and products. Session/kiosk endpoints are public (see `shopping-flow.md`).

---

## Authentication

**Middleware:** `authenticateOperator` (applied to `/api/stores`, `/api/products`, `/api/transactions`)

### How it works

1. Operator pastes their API key into the dashboard UI prompt
2. Frontend stores it in `localStorage` and attaches `x-api-key` header to all requests
3. Backend looks up the operator by API key: `Operator.findOne({ where: { api_key } })`
4. If valid, attaches `req.operator` for downstream route handlers
5. If missing or invalid → `401 UNAUTHORIZED`

### Validation on startup

The dashboard validates the key immediately by calling `GET /api/stores`. On `401`, the prompt shows an error. On success, the "Connected" indicator appears.

### Demo key

The seeder creates a deterministic key: `tinymart-demo-key-2026`. This is documented in the README so interviewers can connect instantly.

---

## Store Management

All store endpoints are scoped to the authenticated operator — an operator can only see and modify their own stores.

### Create Store

**Endpoint:** `POST /api/stores`
**Auth:** Required

**Request body:**
```json
{ "name": "Downtown Fridge", "location_name": "Main Street", "address": "123 Main St" }
```

- `name` is required
- `location_name` and `address` are optional
- `operator_id` is set automatically from the authenticated operator
- Store starts with `status: "online"`

**Database effect:**
- Creates one `stores` row

### List Stores

**Endpoint:** `GET /api/stores`
**Auth:** Required

Returns all stores owned by the authenticated operator. Each store includes a count of associated `store_products` (used to display product count on dashboard cards).

### Get Store Detail

**Endpoint:** `GET /api/stores/:id`
**Auth:** Required

Returns the store with all `store_products` and their associated `products` (name, price, SKU, category). Used by the store detail page to render the inventory table.

**Authorization:** If the store exists but belongs to a different operator → `404 STORE_NOT_FOUND` (does not leak existence).

---

## Product Catalog

Products are global to an operator — they exist independently of stores. A product is linked to a store via the `store_products` join table, which adds inventory fields (`quantity_on_hand`, `low_stock_threshold`).

### Create Product

**Endpoint:** `POST /api/products`
**Auth:** Required

**Request body:**
```json
{ "name": "Cola", "sku": "COLA-001", "price_cents": 249, "category": "fridge", "image_url": null }
```

**Validation:**
- `name` — required string
- `sku` — required string, must be unique per operator (enforced by DB unique constraint)
- `price_cents` — required positive integer
- `category` — required, one of: `pantry`, `fridge`, `freezer`
- `image_url` — optional

**Error cases:**
- Duplicate SKU → `409 DUPLICATE_SKU`

**Database effect:**
- Creates one `products` row

### List Products

**Endpoint:** `GET /api/products`
**Auth:** Required

Returns all products owned by the authenticated operator. Supports optional `?category=fridge` filter.

---

## Inventory Management

Inventory is event-sourced. Every change to `quantity_on_hand` goes through `adjustInventory()`, which appends an `inventory_events` row and atomically updates `store_products.quantity_on_hand` with optimistic locking.

### Add Product to Store

**Endpoint:** `POST /api/stores/:id/products`
**Auth:** Required

**Request body:**
```json
{ "product_id": "uuid", "quantity_on_hand": 20, "low_stock_threshold": 5 }
```

- `product_id` — required, must be a product owned by the same operator
- `quantity_on_hand` — optional (defaults to model default: 0)
- `low_stock_threshold` — optional (defaults to model default: 5)

**Error cases:**
- Product already in store → `409 PRODUCT_ALREADY_IN_STORE`
- Product belongs to different operator → `404 PRODUCT_NOT_FOUND`

**Database effect:**
- Creates one `store_products` row

### Update Inventory

**Endpoint:** `PATCH /api/stores/:id/products/:productId`
**Auth:** Required

**Request body:**
```json
{ "quantity_on_hand": 25, "low_stock_threshold": 3 }
```

At least one field is required. When `quantity_on_hand` changes:

1. Computes `delta = newQty - currentQty`
2. If `delta > 0` → calls `adjustInventory({ eventType: "restock", quantity: delta })`
3. If `delta < 0` → calls `adjustInventory({ eventType: "deduct", quantity: |delta| })`
4. If `delta === 0` → no inventory event created

### What `adjustInventory()` does

1. Reads the `store_product` row (including current `version`)
2. Computes the signed delta based on event type:
   - `restock`, `release` → positive (add stock)
   - `reserve`, `deduct` → negative (remove stock)
3. For subtractive events: validates `quantity_on_hand + delta >= 0` → `409 INSUFFICIENT_STOCK` if not
4. Executes optimistic locking update:
   ```sql
   UPDATE store_products
   SET quantity_on_hand = quantity_on_hand + :delta,
       version = version + 1
   WHERE id = :id AND version = :currentVersion
   ```
5. If `rowCount === 0` → `409 STALE_VERSION` (concurrent modification, caller retries)
6. Creates an `inventory_events` row with the delta, version, and optional reference

**Why raw SQL:** Sequelize ORM doesn't support `WHERE` clauses on updates. This trade-off is documented in the code.

### View Inventory Event History

**Endpoint:** `GET /api/stores/:id/products/:productId/events`
**Auth:** Required

Returns paginated inventory events for a store product, ordered by version descending (newest first).

**Query params:** `?limit=50&offset=0` (max limit: 100)

**Response:**
```json
{ "events": [...], "total": 42 }
```

Each event contains: `event_type`, `quantity` (signed delta), `version`, `reference_id`, `reference_type`, `metadata`, `created_at`.

---

## Transaction History

Transactions are created automatically when a shopping session closes with items. Operators view them as a read-only ledger.

### List Transactions

**Endpoint:** `GET /api/transactions`
**Auth:** Required

Returns paginated transactions across all of the operator's stores.

**Query params:**
- `?store_id=uuid` — filter by specific store
- `?status=succeeded` — filter by status (`succeeded`, `pending`, `failed`)
- `?from=2026-03-01&to=2026-03-31` — date range filter on `created_at`
- `?limit=50&offset=0` — pagination (max limit: 100)

**Scoping:** Automatically filtered to stores owned by the authenticated operator. If `store_id` is provided but doesn't belong to the operator, returns empty results (no error, no information leak).

**Response:**
```json
{ "transactions": [...], "total": 15, "limit": 50, "offset": 0 }
```

Each transaction includes the associated store name.

### Get Transaction Detail

**Endpoint:** `GET /api/transactions/:id`
**Auth:** Required

Returns the full transaction with:
- Store info (name, location)
- Session with all session items
- Each session item with product details (name, price, SKU, category)

**Authorization:** Verifies the transaction's store belongs to the authenticated operator → `404` if not.

---

## System Health Monitoring

Health endpoints are public (no auth) and mounted before the rate limiter so monitoring services aren't throttled.

### Liveness

**Endpoint:** `GET /health`

Simple "is the process running?" check. Always returns `200` with `{ status: "ok" }`.

### Readiness

**Endpoint:** `GET /health/ready`

Checks all registered dependencies via the `DependencyRegistry`:

| Dependency | Health check | Healthy | Degraded | Unavailable |
|------------|-------------|---------|----------|-------------|
| Database | `sequelize.authenticate()` | Connected | — | Connection failed |
| Stripe | Circuit breaker state | `closed` | `half_open` | `open` |
| Job Queue | `getJobQueue() !== null` | Running | — | Not started / error |

**Response logic:**
- Database down → `503` with `status: "unavailable"`
- Database up, others down → `200` with `status: "degraded"`
- All healthy → `200` with `status: "ready"`

### Detailed Diagnostics

**Endpoint:** `GET /health/detailed`

Full system diagnostics including:
- Dependency statuses (database, Stripe, job queue)
- Circuit breaker state (closed/open/half_open, failure count, last failure time)
- Job queue info (registered queues, dead letter count)
- System metrics (uptime, memory: RSS/heap_used/heap_total)

**Note:** This endpoint is unauthenticated and exposes internal details. See `docs/todo.md` (Should Fix section) for the security warning.

---

## API Endpoints Summary

### Stores (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/stores` | Create store |
| `GET` | `/api/stores` | List operator's stores |
| `GET` | `/api/stores/:id` | Get store with products |
| `POST` | `/api/stores/:id/products` | Add product to store |
| `PATCH` | `/api/stores/:id/products/:productId` | Update inventory/threshold |
| `GET` | `/api/stores/:id/products/:productId/events` | Inventory event history |

### Products (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/products` | Create product |
| `GET` | `/api/products` | List products (optional `?category=` filter) |

### Transactions (auth required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transactions` | List transactions (paginated, filterable) |
| `GET` | `/api/transactions/:id` | Transaction detail with session items |

### Health (public)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness with dependency checks |
| `GET` | `/health/detailed` | Full diagnostics |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/middleware/auth.ts` | `authenticateOperator` middleware + `getOperator()` helper |
| `src/routes/stores.ts` | Store CRUD + product assignment + inventory updates |
| `src/routes/products.ts` | Product catalog CRUD |
| `src/routes/transactions.ts` | Transaction listing + detail |
| `src/routes/health.ts` | Health/readiness/detailed endpoints |
| `src/services/inventory.ts` | `adjustInventory()` with optimistic locking |
| `src/services/dependencyRegistry.ts` | Central dependency health monitoring |
| `src/app.ts` | Middleware chain + route mounting |
| `client/src/pages/DashboardPage.tsx` | Store list with create modal |
| `client/src/pages/StoreDetailPage.tsx` | Inventory table + product management |
| `client/src/pages/HealthPage.tsx` | System health dashboard |
| `client/src/contexts/AuthContext.tsx` | API key storage + auth state |

---

## Cross-Cutting Concerns

### Idempotency

All mutation endpoints (`POST`, `PATCH`) pass through the `idempotency` middleware. Every request must include an `Idempotency-Key` header. The frontend auto-generates `crypto.randomUUID()` per mutation. Replayed requests return the cached response.

### Response envelope

Every response uses the standard envelope: `{ success, data, error, meta }`. `meta` always contains `correlation_id` and `timestamp` for tracing.

### Operator scoping

All queries are scoped to the authenticated operator's data. An operator can never access another operator's stores, products, or transactions. Unauthorized access returns `404` (not `403`) to avoid leaking resource existence.

### Rate limiting

All API routes (after health) pass through the rate limiter. Default: 100 requests per 60-second window per IP (configurable via `RATE_LIMIT_WINDOW_MS`).

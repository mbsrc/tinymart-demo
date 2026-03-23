# Step 6: Transaction History

## Context
Operator-facing read endpoints for viewing past transactions. Reuses auth from step 3 and `reconcileCart` from step 4.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/transactions` | Yes | List with filters + pagination |
| `GET` | `/api/transactions/:id` | Yes | Detail with reconciled items |

## Filters (query params on list endpoint)
- `store_id` — UUID, filter by specific store
- `status` — one of pending/succeeded/failed/refunded
- `start_date` / `end_date` — YYYY-MM-DD, filters on `created_at`
- `page` (default 1) / `limit` (default 20, max 100)

## Key Decisions
- **Ownership scoping:** Join `Transaction → Store` with `where: { operator_id }` so operators only see their own data.
- **Pagination:** Offset-based. Add optional `pagination` field to `ResponseMeta` type:
  ```ts
  interface PaginationMeta { page: number; limit: number; total: number; total_pages: number }
  ```
- **Detail endpoint:** Load `Transaction → Session → SessionItems → Product`, run `reconcileCart()` to show final items (not raw events), enrich with product name/sku/price.
- **Pagination helper:** `src/utils/pagination.ts` with `parsePagination(query)` and `paginationMeta(page, limit, total)`.

## Tests
- Auth required (401 without key)
- Returns only operator's transactions
- Each filter works (store_id, status, date range)
- Pagination: correct meta, limit capped at 100
- Detail: includes reconciled items with product info, store name, session dates
- 404 for nonexistent or other operator's transaction

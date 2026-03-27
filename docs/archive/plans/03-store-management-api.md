# Step 3: Store Management API

## Context
First real API endpoints. Introduces auth middleware and product/store CRUD that the rest of V1 depends on.

## Cross-Cutting Utilities (created here, reused in steps 4–6)

| Utility | File | Purpose |
|---------|------|---------|
| `asyncHandler` | `src/utils/asyncHandler.ts` | Wraps async Express handlers — Express 4 doesn't catch rejected promises |
| `buildMeta` | `src/utils/envelope.ts` | Builds `{ correlation_id, timestamp }` from request — reduces boilerplate |
| `authenticateOperator` | `src/middleware/auth.ts` | Reads `x-api-key` header, looks up Operator, attaches to `req.operator` |

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/products` | Yes | Create a product |
| `GET` | `/api/products` | Yes | List operator's products (`?category=` filter) |
| `POST` | `/api/stores` | Yes | Create a store |
| `GET` | `/api/stores` | Yes | List operator's stores |
| `GET` | `/api/stores/:id` | Yes | Store detail with products + inventory |
| `POST` | `/api/stores/:id/products` | Yes | Add existing product to store (creates StoreProduct) |
| `PATCH` | `/api/stores/:id/products/:productId` | Yes | Update quantity/threshold in store |

## Key Decisions
- **Auth:** `x-api-key` header → `Operator.findOne({ where: { api_key } })` → attach to `req.operator`
- **Ownership scoping:** Every query filtered by `operator_id`. Return 404 (not 403) for other operators' resources to avoid leaking existence.
- **Validation:** Manual checks throwing `AppError(400, "VALIDATION_ERROR", ...)`. No validation library for V1.
- **Route structure:** `src/routes/products.ts` (mounted at `/api/products`) and `src/routes/stores.ts` (mounted at `/api/stores`). Store-product endpoints nest under stores router.
- Products must exist before being added to stores → need product CRUD first.

## Tests
- Auth: missing key → 401, invalid key → 401
- CRUD: create/list/detail for stores and products
- Store detail: includes StoreProducts with Product
- Constraints: duplicate SKU → 409, duplicate StoreProduct → 409
- Ownership: another operator's store → 404
- Validation: missing required fields → 400

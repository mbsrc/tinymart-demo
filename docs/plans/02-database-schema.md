# Plan: Phase 1, Step 2 — Database Schema + Migrations + Seed Data

## Context
Project scaffolding is complete. The next step is creating the database schema, Sequelize models, migrations, and seed data. This establishes the data foundation for all V1 features (store management, shopping sessions, transactions, health endpoints).

Only V1 tables are created in this step. V2 reliability tables (idempotency_keys, job_failures, inventory_events) are deferred to their respective Phase 2 tasks.

## Prerequisites
- PostgreSQL running via `bun run db:up`
- Test database exists: `tinymart_test`
- Read `docs/tinymart-prd.md` (Data Model section) and `.claude/rules/database.md` before starting

## Conventions (from `.claude/rules/database.md`)
- Class-based models with `Model.init()` and `Model.associate()`
- `underscored: true` on all models (columns use `snake_case`)
- Table names: `snake_case` plural
- Timestamps: `created_at` / `updated_at`
- All migrations reversible (`up` + `down`), wrapped in transactions
- One logical schema change per migration file

---

## Step 1: Configure Sequelize CLI

### Create `.sequelizerc`
CommonJS file (required by sequelize-cli) pointing to project paths:
```js
const path = require('path')
module.exports = {
  config: path.resolve('src/config/sequelize.cjs'),
  'migrations-path': path.resolve('src/migrations'),
  'seeders-path': path.resolve('src/seeders'),
  'models-path': path.resolve('src/models'),
}
```

### Create `src/config/sequelize.cjs`
Separate CJS config for sequelize-cli (can't use the TypeScript app config):
```js
require('dotenv/config')
module.exports = {
  development: { url: process.env.DATABASE_URL, dialect: 'postgres' },
  test: { url: process.env.DATABASE_URL, dialect: 'postgres' },
  production: {
    url: process.env.DATABASE_URL,
    dialect: 'postgres',
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  },
}
```

### Update `package.json` scripts
The project uses ESM (`"type": "module"`) so sequelize-cli needs `tsx` to handle TypeScript migrations:
```json
"db:migrate": "tsx node_modules/.bin/sequelize-cli db:migrate",
"db:migrate:undo": "tsx node_modules/.bin/sequelize-cli db:migrate:undo",
"db:seed": "tsx node_modules/.bin/sequelize-cli db:seed:all"
```

### Create directories
```
mkdir -p src/migrations src/seeders
```

---

## Step 2: Create 7 Sequelize Models

Each model file follows this pattern: interface for attributes, interface for creation attributes (optional fields), class extending `Model`, `Model.init()` with column definitions, and a static `associate()` method.

All primary keys use `DataTypes.UUID` with `UUIDV4` default.

### `src/models/Operator.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| name | STRING | not null |
| email | STRING | not null, unique |
| api_key | STRING | not null, unique |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** hasMany Store, hasMany Product

### `src/models/Store.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| operator_id | UUID (FK → operators) | not null |
| name | STRING | not null |
| location_name | STRING | |
| address | STRING | |
| status | ENUM('online','offline','maintenance') | not null, default 'offline' |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** belongsTo Operator, hasMany StoreProduct, hasMany Session

### `src/models/Product.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| operator_id | UUID (FK → operators) | not null |
| name | STRING | not null |
| sku | STRING | not null, unique |
| price_cents | INTEGER | not null |
| image_url | STRING | nullable |
| category | ENUM('pantry','fridge','freezer') | not null |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** belongsTo Operator, hasMany StoreProduct

### `src/models/StoreProduct.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| store_id | UUID (FK → stores) | not null |
| product_id | UUID (FK → products) | not null |
| quantity_on_hand | INTEGER | not null, default 0 |
| low_stock_threshold | INTEGER | not null, default 5 |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Constraints:** unique composite (store_id, product_id)
**Associations:** belongsTo Store, belongsTo Product

### `src/models/Session.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| store_id | UUID (FK → stores) | not null |
| stripe_payment_method_id | STRING | nullable |
| stripe_payment_intent_id | STRING | nullable |
| idempotency_key | STRING | unique |
| status | ENUM('open','closed','charged','failed') | not null, default 'open' |
| opened_at | DATE | not null, default now |
| closed_at | DATE | nullable |
| charged_at | DATE | nullable |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** belongsTo Store, hasMany SessionItem, hasOne Transaction

### `src/models/SessionItem.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| session_id | UUID (FK → sessions) | not null |
| product_id | UUID (FK → products) | not null |
| action | ENUM('added','removed') | not null |
| timestamp | DATE | not null, default now |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** belongsTo Session, belongsTo Product

### `src/models/Transaction.ts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID (PK) | default UUIDV4 |
| session_id | UUID (FK → sessions) | not null |
| store_id | UUID (FK → stores) | not null |
| total_cents | INTEGER | not null |
| stripe_charge_id | STRING | nullable |
| idempotency_key | STRING | unique |
| status | ENUM('pending','succeeded','failed','refunded') | not null, default 'pending' |
| created_at | DATE | auto |
| updated_at | DATE | auto |

**Associations:** belongsTo Session, belongsTo Store

### Update `src/models/index.ts`
Import all models, call `associate()` on each, re-export everything:
```typescript
import { Sequelize } from "sequelize"
import { config } from "../config/index.js"
import { databaseConfig } from "../config/database.js"
// ... import all models

export const sequelize = new Sequelize(config.databaseUrl, databaseConfig)

// Import and init models
// Call associate() on each
// Export all models
```

---

## Step 3: Create 7 Migration Files

One file per table, in dependency order. Each migration uses `queryInterface.sequelize.transaction()` for safety.

```
src/migrations/
  20260323000001-create-operators.ts
  20260323000002-create-stores.ts
  20260323000003-create-products.ts
  20260323000004-create-store-products.ts
  20260323000005-create-sessions.ts
  20260323000006-create-session-items.ts
  20260323000007-create-transactions.ts
```

**Migration pattern:**
```typescript
import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("table_name", { ... }, { transaction })
      // Add indexes
    })
  },
  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("table_name", { transaction })
    })
  },
}
```

**Indexes to add:**
- `stores.operator_id`
- `products.operator_id`
- `store_products.(store_id, product_id)` — unique composite
- `sessions.store_id`, `sessions.idempotency_key` — unique
- `session_items.session_id`, `session_items.product_id`
- `transactions.session_id`, `transactions.store_id`, `transactions.idempotency_key` — unique

---

## Step 4: Create Seed Data

### `src/seeders/20260323000001-demo-data.ts`

Per the PRD: 1 operator, 2 stores, 10 products, sample transactions.

**Operator:**
- "TinyMart Demo" / demo@tinymart.dev / uuid API key

**Stores:**
- "Downtown Fridge" (online) — urban convenience
- "Campus Market" (online) — university location

**Products (10):**
| Name | SKU | Price | Category |
|------|-----|-------|----------|
| Bottled Water | WAT-001 | 199 | fridge |
| Cola | COL-001 | 249 | fridge |
| Orange Juice | OJ-001 | 349 | fridge |
| Greek Yogurt | YOG-001 | 299 | fridge |
| Energy Bar | BAR-001 | 199 | pantry |
| Trail Mix | MIX-001 | 399 | pantry |
| Chips | CHP-001 | 249 | pantry |
| Ice Cream Bar | ICE-001 | 349 | freezer |
| Frozen Burrito | BUR-001 | 449 | freezer |
| Sandwich | SAN-001 | 549 | fridge |

**Store Products:** All 10 products in both stores, varied quantities (5–20), threshold 3–5.

**Sample Session:** One completed session at "Downtown Fridge" — 3 items added, 1 removed, closed and charged. Creates session_items and a succeeded transaction.

---

## Step 5: Write Tests

### `tests/models.test.ts`
- Verify all models can sync to the test database
- Verify associations (e.g., `Store.findAll({ include: [Product] })`)
- Verify unique constraints reject duplicates

### `tests/migrations.test.ts` (or manual verification)
- Run `bun run db:migrate` → verify all tables exist
- Run `bun run db:seed` → verify seed data
- Run `bun run db:migrate:undo` → verify clean rollback

---

## Files to create/modify
- `.sequelizerc` (new)
- `src/config/sequelize.cjs` (new)
- `src/models/Operator.ts` (new)
- `src/models/Store.ts` (new)
- `src/models/Product.ts` (new)
- `src/models/StoreProduct.ts` (new)
- `src/models/Session.ts` (new)
- `src/models/SessionItem.ts` (new)
- `src/models/Transaction.ts` (new)
- `src/models/index.ts` (update — import/associate all models)
- `src/migrations/` — 7 migration files (new)
- `src/seeders/` — 1 seeder file (new)
- `package.json` (update db:* scripts for tsx)
- `docs/progress.md` (mark step 2 complete)

## Verification
1. `bun run db:up` — ensure PostgreSQL is running
2. `bun run db:migrate` — all 7 tables created
3. `bun run db:seed` — demo data inserted
4. `bun run test` — all tests pass (existing + new model tests)
5. `bun run db:migrate:undo` — clean rollback, no tables remain
6. `bun run db:migrate && bun run db:seed` — re-run to confirm idempotent

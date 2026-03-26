---
paths:
  - "src/models/**/*.ts"
  - "src/migrations/**/*.ts"
  - "src/config/database.ts"
  - "src/config/sequelize.cjs"
---

# Database Rules

## Sequelize Models
- Use class-based syntax with `Model.init()` and `Model.associate()`
- Enable `underscored: true` on all models — columns use `snake_case`
- Table names are `snake_case` plural (e.g. `store_products`, `inventory_events`)
- Timestamps via `created_at` / `updated_at`, not camelCase

## Migrations
- All migrations must be reversible — every `up` needs a matching `down`
- Wrap multi-statement migrations in a transaction (`queryInterface.sequelize.transaction`)
- One logical schema change per migration file
- Never modify a migration that has already been committed — create a new one instead

## Queries
- Use Sequelize model methods and scopes over raw SQL
- Raw SQL is acceptable only for complex joins or performance-critical paths — add a comment explaining why

## Sequelize CLI
- Project is ESM (`"type": "module"`) but sequelize-cli requires CJS
- Run migrations with: `tsx node_modules/.bin/sequelize-cli`
- Keep `.sequelizerc` + `src/config/sequelize.cjs` as CJS files

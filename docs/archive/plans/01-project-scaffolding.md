# Plan: Project Scaffolding

## Goal
Set up the foundational project structure so we can start building features.

## Key Decisions
- **Monorepo structure**: Single `src/` for backend. Frontend (React/Vite) will be added later in its own directory.
- **`app.ts` vs `server.ts` split**: Express app config separate from listen call — enables Supertest without binding a port.
- **Config validation at startup**: App crashes immediately if required env vars are missing (fail fast).
- **Logger abstraction**: Wraps BetterStack/Logtail with stdout fallback so the app runs without a token.
- **Response envelope helper**: Single `envelope()` function enforces `{ success, data, error, meta }` everywhere.
- **Middleware order**: Follows the rule in `.claude/rules/api-design.md` exactly.

## Files to Create

```
package.json
tsconfig.json
biome.json
vitest.config.ts
docker-compose.yml
Procfile
src/
  server.ts          — entry point, starts listening
  app.ts             — Express app setup + middleware chain
  config/
    index.ts         — env validation, typed config export
    database.ts      — Sequelize connection config
  middleware/
    correlationId.ts — attaches X-Correlation-ID
    requestLogger.ts — logs method, path, status, duration on finish
    errorHandler.ts  — 4-arg catch-all, returns envelope
    notFound.ts      — 3-arg 404 handler
  routes/
    health.ts        — GET /health, /health/ready, /health/detailed
  models/
    index.ts         — Sequelize instance + model registry (empty for now)
  types/
    index.ts         — ApiResponse envelope type, AppError type
  utils/
    logger.ts        — structured logger (BetterStack + stdout fallback)
    envelope.ts      — response envelope builder
tests/
  health.test.ts     — smoke test: health endpoint returns 200
```

## Dependencies
**Runtime**: express, sequelize, pg, pg-hstore, stripe, @logtail/node, pg-boss, dotenv, uuid
**Dev**: typescript, @types/node, @types/express, @types/uuid, vitest, supertest, @types/supertest, @biomejs/biome, tsx

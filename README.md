# TinyMart

A miniature autonomous smart store platform simulating the full shopping lifecycle:
tap card → open fridge → grab items → close door → get charged.

Built as a backend reliability demo — idempotent payments, circuit breakers, structured observability, and resilient async workflows.

## Tech Stack

Node.js 22, TypeScript (strict), Express, PostgreSQL + Sequelize, Stripe (test mode), pg-boss, BetterStack, Vitest + Supertest

## Quick Start

```bash
git clone https://github.com/you/tinymart.git
cd tinymart
bun install
cp .env.example .env          # fill in your Stripe test keys
bun run db:up                  # starts PostgreSQL
bun run db:migrate
bun run db:seed
bun run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Compile TypeScript to `dist/` |
| `bun run start` | Run production build |
| `bun run test` | Run tests |
| `bun run lint` | Check formatting and lint rules |
| `bun run lint:fix` | Auto-fix formatting |
| `bun run db:up` | Start PostgreSQL container |
| `bun run db:down` | Stop PostgreSQL container |
| `bun run db:migrate` | Run database migrations |
| `bun run db:seed` | Seed demo data |

## Project Structure

```
src/
  server.ts              Entry point
  app.ts                 Express app + middleware chain
  config/                Env validation, database config
  middleware/            Correlation ID, request logger, error handler
  routes/                API route handlers
  models/                Sequelize models
  types/                 Shared TypeScript types
  utils/                 Logger, response envelope
tests/                   Vitest + Supertest
```

## Environment Variables

See [`.env.example`](.env.example) for the full list. Required vars are validated at startup — the app crashes immediately if any are missing.

## License

Private

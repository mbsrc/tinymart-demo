# TinyMart

A miniature autonomous smart store platform simulating the full shopping lifecycle:
**tap card → open fridge → grab items → close door → get charged.**

Built as a backend reliability demo targeting the Senior Backend Reliability Engineer role. Every backend decision is made through the lens of resilience: idempotent payments, circuit breakers, graceful degradation, structured observability, and hardened async workflows.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Express API                          │
│                                                             │
│  Middleware chain (strictly ordered):                        │
│  trust proxy → json parser → correlation ID → request logger│
│  → health routes → rate limiter → degradation context       │
│  → auth + idempotency → API routes → 404 → error handler   │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │   Stores &   │  │   Products &  │  │   Health &       │ │
│  │   Inventory  │  │   Catalog     │  │   Diagnostics    │ │
│  └──────┬───────┘  └───────┬───────┘  └────────┬─────────┘ │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼────────┐  │
│  │  Circuit Breaker  →  Retry w/ Backoff + Jitter        │  │
│  │  Deferred Charging  →  Safe Job Enqueue (DB fallback) │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  pg-boss Job Queue                                    │  │
│  │  send-receipt · deduct-inventory · replay-pending     │  │
│  │  process-deferred-charges · cleanup-idempotency-keys  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐     ┌──────────────────┐
              │    PostgreSQL       │     │   Stripe          │
              │    (Sequelize ORM)  │     │   (test mode)     │
              └─────────────────────┘     └──────────────────┘
                                                │
                                          ┌─────▼──────────┐
                                          │  BetterStack    │
                                          │  (structured    │
                                          │   logging)      │
                                          └────────────────┘
```

## Reliability Patterns

| Pattern | What it does | Key files |
|---------|-------------|-----------|
| **Idempotency** | POST/PATCH require `Idempotency-Key` header. Replays return cached response. Keys expire after 24h. | `src/middleware/idempotency.ts` |
| **Circuit Breaker** | Wraps Stripe calls. Opens after 5 failures, rejects fast for 30s, then probes. | `src/utils/circuitBreaker.ts`, `src/services/stripe.ts` |
| **Retry + Backoff** | Retries 5xx/network errors with exponential backoff + jitter. Never retries 4xx. | `src/utils/retry.ts` |
| **Graceful Degradation** | Dependency registry tracks health. Stripe down → charges deferred to DB. pg-boss down → jobs saved to `pending_jobs` table. | `src/services/dependencyRegistry.ts`, `src/services/deferredCharge.ts`, `src/jobs/safeEnqueue.ts` |
| **Rate Limiting** | Sliding window per API key/IP. Returns `429` with `Retry-After` header. | `src/middleware/rateLimiter.ts` |
| **Event Sourcing** | Inventory changes are append-only events. Current stock derived from event stream. Optimistic locking via version column. | `src/services/inventory.ts`, `src/models/InventoryEvent.ts` |
| **Correlation IDs** | Every request gets `X-Correlation-ID`. Propagated through logs and responses. | `src/middleware/correlationId.ts` |
| **Background Jobs** | pg-boss handles receipts, inventory deduction, cleanup, and recovery jobs. Dead letter tracking in `job_failures` table. | `src/jobs/` |
| **Health Checks** | `/health` (liveness), `/health/ready` (readiness + degradation), `/health/detailed` (full diagnostics). | `src/routes/health.ts` |

## Quick Start

```bash
git clone https://github.com/you/tinymart.git
cd tinymart
bun install
cp .env.example .env          # fill in your Stripe test keys
bun run db:up                 # starts PostgreSQL via Docker
bun run db:migrate            # run all migrations
bun run db:seed               # creates demo operator, 2 stores, 10 products
bun run dev                   # starts API at http://localhost:3001
```

To get the demo operator's API key:

```bash
psql "$DATABASE_URL" -t -c "SELECT api_key FROM operators LIMIT 1"
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22 + TypeScript (strict) |
| Framework | Express.js |
| Database | PostgreSQL + Sequelize V6 ORM |
| Payments | Stripe (test mode) |
| Background Jobs | pg-boss (Postgres-backed, no Redis) |
| Logging | BetterStack / Logtail (falls back to stdout) |
| Testing | Vitest + Supertest |
| Linting | Biome |
| Package Manager | bun |

## API Reference

All endpoints require `x-api-key` header for authentication. All mutation endpoints (POST, PATCH) require an `Idempotency-Key` header.

Every response uses a consistent envelope:

```json
{
  "success": true,
  "data": { "..." },
  "error": null,
  "meta": { "correlation_id": "abc-123", "timestamp": "2026-03-23T..." }
}
```

### Stores

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/stores` | Create a store |
| `GET` | `/api/stores` | List operator's stores |
| `GET` | `/api/stores/:id` | Store detail with products |
| `POST` | `/api/stores/:id/products` | Add product to store |
| `PATCH` | `/api/stores/:id/products/:productId` | Update quantity or threshold |
| `GET` | `/api/stores/:id/products/:productId/events` | Inventory event history |

### Products

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/products` | Create a product |
| `GET` | `/api/products` | List products (optional `?category=` filter) |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check (always 200) |
| `GET` | `/health/ready` | Readiness — 200 if DB up, reports degradation |
| `GET` | `/health/detailed` | Full diagnostics: circuit breakers, job queue, dependencies, uptime, memory |

### Example Requests

```bash
API_KEY="your-api-key-here"

# List stores
curl -H "x-api-key: $API_KEY" http://localhost:3001/api/stores

# Create a product
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"name": "Sparkling Water", "sku": "SW-001", "price_cents": 299, "category": "fridge"}'

# Check system health
curl http://localhost:3001/health/detailed | jq
```

## Testing

```bash
bun run test              # run all tests
bun run test:watch        # watch mode
```

126 tests across 15 test files covering middleware, routes, services, models, and reliability patterns.

### Load Testing

Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed.

```bash
k6 run -e API_KEY="$API_KEY" load-tests/smoke.js
```

See [`load-tests/README.md`](load-tests/README.md) for scenario details and thresholds.

## BetterStack Setup

Structured logging is built in. To see logs in BetterStack:

1. Create a [BetterStack](https://betterstack.com) account and add a new **Logtail source**
2. Copy the source token
3. Add to your `.env`: `BETTERSTACK_SOURCE_TOKEN=your_token_here`
4. Restart the server — logs now flow to BetterStack alongside stdout

All log entries include timestamp, level, correlation ID, and request context as structured JSON. When the token is not set, the app logs to stdout only (no errors, no degradation).

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Compile TypeScript to `dist/` |
| `bun run start` | Run production build |
| `bun run test` | Run all tests |
| `bun run test:watch` | Watch mode |
| `bun run lint` | Lint and auto-format |
| `bun run db:up` | Start PostgreSQL container |
| `bun run db:down` | Stop PostgreSQL container |
| `bun run db:migrate` | Run database migrations |
| `bun run db:migrate:undo` | Undo last migration |
| `bun run db:seed` | Seed demo data |
| `bun run load-test` | Run k6 load tests |

## Project Structure

```
src/
  server.ts                Entry point + dependency registry setup
  app.ts                   Express app + middleware chain
  config/                  Env validation, database config
  middleware/              Auth, correlation ID, degradation, error handler,
                           idempotency, rate limiter, request logger
  routes/                  API route handlers (stores, products, health)
  models/                  Sequelize models (13 models)
  services/                Stripe, inventory, dependency registry, deferred charges
  jobs/
    queue.ts               pg-boss lifecycle
    safeEnqueue.ts         Enqueue with DB fallback
    handlers/              Job handlers (receipts, inventory, cleanup, replay)
  types/                   Shared TypeScript types
  utils/                   Circuit breaker, retry, logger, envelope, async handler
  migrations/              13 reversible migrations
  seeders/                 Demo data seeder
tests/                     15 test files (Vitest + Supertest)
load-tests/                k6 load test scripts
docs/
  plans/                   Implementation plans for each step
  progress.md              Phase tracking
  tinymart-prd.md          Product requirements document
```

## Environment Variables

See [`.env.example`](.env.example) for the full list.

**Required** (app crashes at startup if missing):
- `DATABASE_URL` — PostgreSQL connection string
- `STRIPE_SECRET_KEY` — Stripe test secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `PORT` — Server port (default: 3001)
- `NODE_ENV` — `development`, `test`, or `production`

**Optional:**
- `BETTERSTACK_SOURCE_TOKEN` — Logtail source token (falls back to stdout)
- `RATE_LIMIT_WINDOW_MS` — Rate limit window in ms (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` — Max requests per window (default: 100)

## License

Private

# 🏪 TinyMart

A miniature autonomous smart store platform simulating the full shopping lifecycle:
**tap card → open fridge → grab items → close door → get charged.**

Built as a backend reliability demo targeting the Senior Backend Reliability Engineer role. Every backend decision is made through the lens of resilience: idempotent payments, circuit breakers, graceful degradation, structured observability, and hardened async workflows.

### How This Maps to the Role

| JD Requirement | TinyMart Feature |
|----------------|------------------|
| Prevent retry storms, cascading failures | Circuit breaker on Stripe + retry with jitter |
| Rate limiting, idempotency, safe retry | Idempotency middleware + sliding window rate limiter + exponential backoff |
| Database and caching performance | Optimistic locking, event sourcing, indexed queries |
| Harden background jobs | pg-boss with dead letter queue + DB fallback when queue is down |
| Payment authorization success rates | Stripe pre-auth/capture flow with circuit breaker + deferred charging |
| Dashboards, logging, alert quality | BetterStack structured logging + correlation IDs + `/health/detailed` |
| Deployment safety, rollbacks | Reversible migrations, health checks, Heroku release phase |
| Systems that fail gracefully | Graceful degradation across all external dependencies |

---

## 🚀 Quick Start

**Prerequisites:** [Node.js 22+](https://nodejs.org/), [bun](https://bun.sh/), [Docker](https://docs.docker.com/get-docker/)

```bash
git clone https://github.com/mbsrc/tinymart-demo.git
cd tinymart-demo
bun install
cp .env.example .env
```

For the full Stripe payment flow, open `.env` and replace the Stripe keys with your own [Stripe test keys](https://dashboard.stripe.com/test/apikeys):

```
STRIPE_SECRET_KEY=sk_test_...            # optional — placeholder works, payments degrade gracefully
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # optional — kiosk skips card entry if missing
```

Then start the database and server:

```bash
bun run db:up                 # starts PostgreSQL via Docker (port 5433)
bun run db:migrate            # run all migrations
bun run db:seed               # creates demo operator, 2 stores, 10 products
bun run dev                   # starts API (3001) + frontend (5173)
```

Open **http://localhost:5173** and enter the demo API key: `tinymart-demo-key-2026`

---

## 🎮 Try the Demo

Once the server is running, walk through the full lifecycle in about 2 minutes:

**1. Operator Dashboard** — Open http://localhost:5173, enter the API key. You'll see two stores (Downtown Fridge, Campus Market) with product counts and status badges.

**2. Store Detail** — Click a store. Browse the product table with quantities, low-stock warnings, and SKUs. Try editing inventory via the Edit button.

**3. Shopper Kiosk** — Click a kiosk link in the sidebar (e.g. "Downtown Fridge"). Tap to start, enter a [Stripe test card](https://docs.stripe.com/testing#cards) (`4242 4242 4242 4242`, any future date, any CVC), add a few items, and hit "Close Door & Pay." You'll see an itemized receipt with the total.

**4. Transaction History** — Go back to the dashboard, click "Transactions" in the sidebar. Your kiosk purchase appears with status, store, total, and date. Click the row to expand the itemized detail.

**5. System Health** — Click "System Health" in the sidebar. See dependency status (database, Stripe, job queue), circuit breaker state, memory usage, and uptime.

---

## 🔨 Poke the Reliability

These curl commands let you test the reliability patterns hands-on. Run them while the dev server is up.

### Idempotency replay

Send the same request twice with the same key — the second call returns the cached response without re-executing:

```bash
KEY=$(uuidgen)

# First call — creates the product
curl -s -X POST http://localhost:3001/api/products \
  -H "x-api-key: tinymart-demo-key-2026" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"name":"Replay Test","sku":"REPLAY-001","price_cents":100,"category":"pantry"}' | jq .

# Second call — same key, returns cached response (no duplicate created)
curl -s -X POST http://localhost:3001/api/products \
  -H "x-api-key: tinymart-demo-key-2026" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"name":"Replay Test","sku":"REPLAY-001","price_cents":100,"category":"pantry"}' | jq .
```

Both responses return the same product with the same `id`. Check the `X-Idempotency-Replay: true` header on the second response:

```bash
curl -s -I -X POST http://localhost:3001/api/products \
  -H "x-api-key: tinymart-demo-key-2026" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $KEY" \
  -d '{"name":"Replay Test","sku":"REPLAY-001","price_cents":100,"category":"pantry"}' \
  2>&1 | grep -i idempotency
```

### Rate limiting

Blast 10 requests in quick succession — watch the remaining count drop and eventually hit `429`:

```bash
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "Request $i: HTTP %{http_code} | " \
    -H "x-api-key: tinymart-demo-key-2026" \
    http://localhost:3001/api/stores
done
echo ""

# Check your remaining quota
curl -s -I -H "x-api-key: tinymart-demo-key-2026" \
  http://localhost:3001/api/stores 2>&1 | grep -i x-ratelimit
```

### Circuit breaker + health diagnostics

Inspect the circuit breaker state and full system diagnostics:

```bash
curl -s http://localhost:3001/health/detailed | jq '{
  status: .data.status,
  stripe_circuit: .data.circuit_breakers.stripe,
  dependencies: .data.dependencies | to_entries | map({(.key): .value.status}) | add,
  uptime_seconds: .data.uptime | floor,
  heap_mb: (.data.memory.heap_used / 1048576 | floor)
}'
```

### Correlation ID tracing

Every request gets a unique correlation ID — grab it from any response and use it to trace through logs:

```bash
curl -s -D- -H "x-api-key: tinymart-demo-key-2026" \
  http://localhost:3001/api/stores 2>&1 | grep -i "x-correlation-id\|correlation_id"
```

The same ID appears in the response header (`X-Correlation-ID`), the response body (`meta.correlation_id`), and all server logs for that request.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────── ─┐
│                     React Frontend (Vite)                    │
│  Dashboard · Store Detail · Transactions · Kiosk · Health    │
└──────────────────────────┬───────────────────────────────── ─┘
                           │
┌──────────────────────────▼─────────────────────────────────-─┐
│                        Express API                           │
│                                                              │
│  Middleware chain (strictly ordered):                        │
│  helmet → trust proxy → cors → json parser → correlation ID  │
│  → request logger → health routes → rate limiter             │
│  → degradation → auth + idempotency → API routes             │
│  → 404 handler → error handler                               │
│                                                              │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐   │
│  │   Stores &   │  │   Sessions &  │  │   Health &       │   │
│  │   Products   │  │  Transactions │  │   Diagnostics    │   │
│  └──────┬───────┘  └───────┬───────┘  └────────┬─────────┘   │
│         │                  │                    │            │
│  ┌──────▼──────────────────▼────────────────────▼────────┐   │
│  │  Circuit Breaker → Retry w/ Backoff + Jitter          │   │
│  │  Deferred Charging → Safe Job Enqueue (DB fallback)   │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  pg-boss Job Queue                                    │   │
│  │  send-receipt · deduct-inventory · replay-pending     │   │
│  │  process-deferred-charges · cleanup-idempotency-keys  │   │
│  └───────────────────────────────────────────────────────┘   │
└────────────────────────┬─────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐     ┌──────────────────┐
              │    PostgreSQL       │     │   Stripe         │
              │    (Sequelize ORM)  │     │   (test mode)    │
              └─────────────────────┘     └──────────────────┘
```

---

## 🛡️ Reliability Patterns

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

---

## 🗃️ Data Model

13 tables in 3 categories:

**Core** — `operators`, `stores`, `products`, `store_products`
Operators own stores. Stores stock products via `store_products` (quantity, low-stock threshold, optimistic lock version).

**Transactions** — `sessions`, `session_items`, `transactions`
A session tracks one shopping visit (open → items added/removed → closed → charged). Session items are event-sourced and reconciled at checkout. Transactions record the final charge.

**Reliability** — `idempotency_keys`, `inventory_events`, `job_failures`, `pending_jobs`, `deferred_charges`
Idempotency keys cache mutation responses (24h TTL). Inventory events are append-only (event sourcing). Job failures track dead letters. Pending jobs are the DB fallback when pg-boss is down. Deferred charges queue payments when Stripe's circuit is open.

All migrations are reversible. Foreign keys cascade on delete. Composite unique indexes prevent duplicates on `store_products` and `inventory_events`.

---

## ⚙️ Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22 + TypeScript (strict) |
| Backend | Express.js |
| Frontend | React 19 + Vite + Tailwind CSS 4 + TanStack Query |
| Database | PostgreSQL + Sequelize V6 ORM |
| Payments | Stripe (test mode) |
| Background Jobs | pg-boss (Postgres-backed, no Redis) |
| Logging | BetterStack / Logtail (falls back to stdout) |
| Testing | Vitest + Supertest + React Testing Library + Playwright |
| Linting | Biome |
| Package Manager | bun |

---

## 📡 API Reference

All endpoints except `/health/*` require an `x-api-key` header. All mutation endpoints (POST, PATCH) require an `Idempotency-Key` header.

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

### Sessions (Kiosk)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Open a new shopping session (pre-authorize card) |
| `GET` | `/api/sessions/:id` | Get session with items |
| `POST` | `/api/sessions/:id/items` | Add or remove item from cart |
| `POST` | `/api/sessions/:id/close` | Close door, capture payment, deduct inventory |

### Transactions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/transactions` | List transactions (filters: `store_id`, `status`, `from`, `to`) |
| `GET` | `/api/transactions/:id` | Transaction detail with itemized receipt |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check (always 200) |
| `GET` | `/health/ready` | Readiness — DB up, Stripe reachable, reports degradation |
| `GET` | `/health/detailed` | Full diagnostics: circuit breakers, job queue, dependencies, uptime, memory |

---

## ✅ Testing

```bash
bun run test              # backend tests (Vitest + Supertest)
bun run test:client       # frontend tests (Vitest + React Testing Library)
bun run test:pw           # end-to-end tests (Playwright)
```

**Backend:** 221 tests across 24 test files covering middleware, routes, services, models, and reliability patterns.
**Frontend:** 130 UI tests (Vitest + React Testing Library + MSW) covering all pages and components.
**E2E:** 5 Playwright specs covering auth, dashboard, store detail, kiosk checkout, and health page.

### Load Testing

Requires [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) installed.

```bash
k6 run -e API_KEY="tinymart-demo-key-2026" load-tests/smoke.js
```

See [`load-tests/README.md`](load-tests/README.md) for scenario details and thresholds.

---

## 📁 Project Structure

```
src/
  server.ts                Entry point + dependency registry setup
  app.ts                   Express app + middleware chain
  config/                  Env validation, database config
  middleware/              Auth, correlation ID, degradation, error handler,
                           idempotency, rate limiter, request logger
  routes/                  stores, products, sessions, transactions, health
  models/                  13 Sequelize models
  services/                Stripe, inventory, dependency registry, deferred charges
  jobs/
    queue.ts               pg-boss lifecycle
    safeEnqueue.ts         Enqueue with DB fallback
    handlers/              Job handlers (receipts, inventory, cleanup, replay)
  types/                   Shared TypeScript types
  utils/                   Circuit breaker, retry, logger, envelope, async handler
  migrations/              13 reversible migrations
  seeders/                 Demo data seeder
client/
  src/
    api/                   API client modules (stores, products, sessions, transactions, health)
    components/            UI components (kiosk, health, modals, shared)
    contexts/              Auth context (API key management)
    hooks/                 React Query hooks
    pages/                 Dashboard, StoreDetail, Transactions, Kiosk, Health
    types/                 Frontend TypeScript types
    utils/                 Formatting, cart reconciliation
tests/                     24 backend test files (Vitest + Supertest)
e2e/                       5 Playwright specs + fixtures
load-tests/                k6 load test scripts
docs/
  tinymart-prd.md          Product requirements document
  plans/                   Implementation plans for each phase
  progress.md              Phase tracking
```

---

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start API + frontend with hot reload |
| `bun run build` | Compile TypeScript + build frontend |
| `bun run start` | Run production build |
| `bun run test` | Run backend tests |
| `bun run test:client` | Run frontend tests |
| `bun run test:pw` | Run Playwright E2E tests |
| `bun run lint` | Lint and auto-format (Biome) |
| `bun run db:up` | Start PostgreSQL container |
| `bun run db:down` | Stop PostgreSQL container |
| `bun run db:migrate` | Run database migrations |
| `bun run db:migrate:undo` | Undo last migration |
| `bun run db:seed` | Seed demo data |
| `bun run load-test` | Run k6 load tests |

---

## 🔐 Environment Variables

See [`.env.example`](.env.example) for the full list with defaults.

**Required** (app crashes at startup if missing):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default in .env.example: `3001`) |
| `NODE_ENV` | `development`, `test`, or `production` |

**Optional:**

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe test secret key (`sk_test_...`). Placeholder from `.env.example` works — payments degrade gracefully via circuit breaker. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for kiosk card entry (`pk_test_...`). Kiosk skips card entry if not set. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `BETTERSTACK_SOURCE_TOKEN` | Logtail source token (falls back to stdout if missing) |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: 60000) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window (default: 100) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins (default: `*`) |

---

## 📊 BetterStack Setup

Structured logging is built in. To see logs in BetterStack:

1. Create a [BetterStack](https://betterstack.com) account and add a new **Logtail source**
2. Copy the source token
3. Add to your `.env`: `BETTERSTACK_SOURCE_TOKEN=your_token_here`
4. Restart the server — logs now flow to BetterStack alongside stdout

All log entries include timestamp, level, correlation ID, and request context as structured JSON. When the token is not set, the app logs to stdout only (no errors, no degradation).

---

## ☁️ Deploying to Heroku

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0

heroku config:set NODE_ENV=production
heroku config:set STRIPE_SECRET_KEY=sk_test_...

# Optional
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
heroku config:set BETTERSTACK_SOURCE_TOKEN=your_token

git push heroku develop:main

# Seed demo data (first deploy only)
heroku run "npx tsx node_modules/.bin/sequelize-cli db:seed:all"

heroku open
```

Migrations run automatically on each deploy via the `release` phase in the Procfile. The `app.json` manifest defines all env vars and addons for Heroku's "Deploy to Heroku" button.

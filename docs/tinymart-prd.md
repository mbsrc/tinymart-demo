# TinyMart — Product Requirements Document

## Overview

TinyMart is a miniature, fully working simulation of an autonomous smart store platform — inspired
by Micromart's real product. It models the complete lifecycle: a shopper taps their card, opens a
smart fridge, grabs items, closes the door, and gets charged. An operator manages stores, products,
and inventory from a dashboard.

The application is deliberately small in scope but deep in backend reliability. Every backend
decision is made through the lens of a Senior Backend Reliability Engineer: idempotent payments,
circuit breakers on external calls, graceful degradation, structured observability, and resilient
async workflows.

**Primary audience:** Micromart engineering interviewers who will clone the repo and run it locally.

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 22 + TypeScript (strict) | Matches Micromart's stack |
| API Framework | Express.js | Matches Micromart's stack |
| Database | PostgreSQL + Sequelize ORM | Matches Micromart's stack |
| Payments | Stripe (test mode) | Matches Micromart's stack |
| Frontend | React (Vite) + Tailwind CSS | Simple, fast, interviewer-friendly |
| Background Jobs | pg-boss (Postgres-backed) | No Redis dependency, single DB |
| Logging | BetterStack (Logtail) | Structured observability |
| Testing | Vitest + Supertest | Fast, TypeScript-native |
| Package Manager | bun | Fast installs, lockfile |
| Linting | Biome | Fast, all-in-one |
| Deployment | Heroku | Matches Micromart's stack |

## Local Development
- PostgreSQL: Docker container (no local install required)
- docker-compose.yml for one-command dev environment setup

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend                     │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Shopper  │  │  Operator    │  │   System      │  │
│  │ Kiosk    │  │  Dashboard   │  │   Health      │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
└───────┼────────────────┼──────────────────┼──────────┘
        │                │                  │
        ▼                ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                   Express API                        │
│                                                      │
│  middleware: correlation-id → rate-limit → idempotency│
│             → error-handler → request-logger         │
│                                                      │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │  Sessions  │ │   Stores &   │ │   Health &     │ │
│  │  Payments  │ │   Products   │ │   Diagnostics  │ │
│  └─────┬──────┘ └──────┬───────┘ └────────┬───────┘ │
│        │               │                  │          │
│  ┌─────▼──────────────────────────────────▼───────┐  │
│  │  Circuit Breaker  │  Retry w/ Backoff          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  pg-boss Job Queue (notifications, receipts)   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │
              ┌────────▼────────┐     ┌──────────────┐
              │   PostgreSQL    │     │    Stripe     │
              │   (Sequelize)   │     │  (test mode)  │
              └─────────────────┘     └──────────────┘
```

---

## Data Model

### Core Tables

**operators**
- id, name, email, api_key, created_at, updated_at

**stores**
- id, operator_id (FK), name, location_name, address, status (online/offline/maintenance), created_at, updated_at

**products**
- id, operator_id (FK), name, sku, price_cents, image_url, category (pantry/fridge/freezer), created_at, updated_at

**store_products** (join — which products are in which store)
- id, store_id (FK), product_id (FK), quantity_on_hand, low_stock_threshold

### Transaction Tables

**sessions**
- id, store_id (FK), stripe_payment_method_id, stripe_payment_intent_id, status (open/closed/charged/failed), opened_at, closed_at, charged_at
- idempotency_key (unique — prevents duplicate session creation)

**session_items**
- id, session_id (FK), product_id (FK), action (added/removed), timestamp

**transactions**
- id, session_id (FK), store_id (FK), total_cents, stripe_charge_id, status (pending/succeeded/failed/refunded), created_at
- idempotency_key (unique — prevents double-charge)

### Reliability Tables

**idempotency_keys**
- key (PK), request_path, request_body_hash, response_status, response_body, created_at, expires_at

**job_failures** (dead letter tracking)
- id, job_name, payload, error_message, attempts, last_attempted_at, created_at

**inventory_events** (event sourcing for inventory)
- id, store_product_id (FK), event_type (sale/restock/adjustment/shrinkage), quantity_change, reference_id, created_at

---

## Features — V1 (Get It Working)

### F1: Store Management (Operator Dashboard)
**What:** Operator can create stores, add products, and view current inventory.

API endpoints:
- `POST /api/stores` — create a store
- `GET /api/stores` — list operator's stores
- `GET /api/stores/:id` — store detail with products and inventory
- `POST /api/stores/:id/products` — add product to store
- `PATCH /api/stores/:id/products/:productId` — update quantity/price

Frontend:
- Store list page with status indicators (online/offline)
- Store detail page showing products, quantities, and low-stock warnings
- Simple forms for adding stores and products

### F2: Shopping Session (Simulated Kiosk)
**What:** Simulated smart fridge experience. Shopper "taps card" → door opens → picks items → door closes → charged.

API endpoints:
- `POST /api/sessions` — open a new session (pre-authorize card via Stripe)
  - Requires: store_id, stripe_payment_method_id
  - Creates: Stripe PaymentIntent with `capture_method: manual`
  - Returns: session_id, session status
- `POST /api/sessions/:id/items` — add or remove item from virtual cart
  - Body: { product_id, action: "added" | "removed" }
- `POST /api/sessions/:id/close` — close door and finalize charge
  - Captures the Stripe PaymentIntent for the final total
  - Deducts inventory
  - Queues receipt notification job
  - Cart reconciliation: collapse all session_items events into a final 
    deduplicated item list, handling duplicates, add-then-remove sequences, 
    and invalid events gracefully before charging

Frontend:
- "Tap to start" screen → card entry (Stripe Elements) → pre-auth
- Product grid showing available items in the store
- Add/remove items with running total
- "Close door" button → confirmation → receipt

### F3: Transaction History
**What:** Operator sees all transactions across their stores.

API endpoints:
- `GET /api/transactions` — list transactions with filters (store, date range, status)
- `GET /api/transactions/:id` — transaction detail with items

Frontend:
- Transaction list with status badges (succeeded/failed/refunded)
- Click into transaction to see itemized receipt

### F4: Health & Status
**What:** System health endpoints for operational visibility.

API endpoints:
- `GET /health` — liveness (200 OK)
- `GET /health/ready` — readiness (DB connected, Stripe reachable, job queue running)
- `GET /health/detailed` — full diagnostics (circuit breaker states, queue depth, recent error rates)

Frontend:
- Simple system status page showing health of all components

---

## Features — V2 (Reliability Hardening)

These are layered ON TOP of V1 once the app works end-to-end. Each one maps directly
to a requirement in the Micromart Senior Backend Reliability Engineer job description.

### R1: Idempotency on All Mutations
**JD mapping:** "Design and implement resilient patterns including idempotency"

- All POST/PATCH/DELETE endpoints require `Idempotency-Key` header
- First request: execute and cache response
- Replay: return cached response without re-executing
- Body mismatch on same key: return 422 error
- Keys expire after 24 hours

### R2: Circuit Breaker on External Calls
**JD mapping:** "Prevent cascading failures and systemic outages"

- Wrap all Stripe API calls in a circuit breaker
- Three states: CLOSED → OPEN (after N failures) → HALF_OPEN (probe) → CLOSED
- When Stripe circuit is OPEN: fail fast with a meaningful error, don't queue retries
- Log state transitions to BetterStack
- Expose circuit state via `/health/detailed`

### R3: Retry with Exponential Backoff + Jitter
**JD mapping:** "Rate limiting, safe retry logic"

- Network failures and 5xx from Stripe: retry with exponential backoff + random jitter
- 4xx (card declined, invalid request): do NOT retry
- Max 3 retries, then route to dead letter
- Jitter prevents thundering herd when multiple stores recover simultaneously

### R4: Background Job Resilience
**JD mapping:** "Harden background jobs and asynchronous workflows"

- Receipt notification: sent via pg-boss background job
- Jobs are idempotent (safe to retry)
- Failed jobs retry up to 3 times with backoff
- After max retries: move to dead letter table, alert via logs
- Job queue depth visible in `/health/detailed`

### R5: Inventory Consistency
**JD mapping:** "Strengthen data integrity across core APIs"

- Inventory deduction happens inside a DB transaction with the payment capture
- Optimistic locking via version column prevents overselling
- Event sourcing: `inventory_events` table is append-only source of truth
- Current inventory materialized from events (can be reconstructed if corrupted)

### R6: Rate Limiting
**JD mapping:** "Design and implement rate limiting"

- Global rate limit: 100 requests/minute per IP
- Session endpoints: 10 requests/minute per session (prevent abuse)
- Operator API: 30 requests/minute per API key
- Return standard `429 Too Many Requests` with `Retry-After` header

### R7: Structured Logging & Correlation
**JD mapping:** "Improve dashboards, logging, and alert quality"

- Every request gets a unique correlation ID (`X-Correlation-ID`)
- All log entries include: timestamp, level, correlation_id, service, endpoint, duration_ms
- Slow query detection: log any DB query > 100ms as a warning
- Error logs include full stack trace and request context
- BetterStack integration for aggregation and search

### R8: Graceful Degradation
**JD mapping:** "Collaborate to design systems that fail gracefully"

- If Stripe is down (circuit open): return clear error "payments temporarily unavailable"
- If notification job fails: transaction still succeeds (notifications are best-effort)
- If BetterStack is unreachable: fall back to stdout logging, don't crash
- Health endpoint degraded state: report which components are unhealthy without going fully down

---

## API Design Conventions

All responses follow a consistent envelope:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "correlation_id": "abc-123",
    "timestamp": "2026-03-22T...",
    "request_id": "req_xyz"
  }
}
```

Error responses:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CIRCUIT_OPEN",
    "message": "Payment service temporarily unavailable",
    "retry_after": 30
  },
  "meta": { ... }
}
```

---

## Database Migrations Strategy

- All migrations are reversible (up + down methods)
- Migrations run automatically on deploy (Heroku release phase)
- Schema changes that lock tables must be documented and tested for duration
- Seed script creates demo data: 1 operator, 2 stores, 10 products, sample transactions

---

## Environment Variables

Required (validated at startup — app crashes if missing):

```
DATABASE_URL=postgresql://localhost:5432/tinymart_dev
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3001
NODE_ENV=development
```

Optional:

```
BETTERSTACK_SOURCE_TOKEN=...     (falls back to stdout if missing)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Getting Started (README preview)

The README must make it trivially easy for an interviewer to run:

```bash
git clone https://github.com/you/tinymart.git
cd tinymart
bun install
cp .env.example .env          # fill in Stripe test keys
docker compose up -d          # starts Postgres
bun run db:migrate
bun run db:seed               # creates demo data
bun run dev                   # starts API + frontend

# Open http://localhost:5173   (operator dashboard)
# Open http://localhost:5173/kiosk/store-1   (shopper kiosk)
```

---

## What This Demo Proves to the Interviewer

| JD Requirement | TinyMart Feature |
|----------------|------------------|
| Prevent retry storms, cascading failures | Circuit breaker + retry with jitter |
| Rate limiting, idempotency, safe retry | Idempotency middleware + rate limiter + backoff |
| Database and caching performance | Optimistic locking, event sourcing, indexed queries |
| Harden background jobs | pg-boss with dead letter queue |
| Payment authorization success rates | Stripe pre-auth/capture flow with circuit breaker |
| Messaging reliability | Notification jobs with retry + dedup |
| Dashboards, logging, alert quality | BetterStack structured logging + correlation IDs |
| Deployment safety, rollbacks | Reversible migrations, health checks, Heroku config |
| Systems that fail gracefully | Graceful degradation across all external dependencies |

---

## Build Order

### Phase 1: Get it working (V1)
1. Project scaffolding (Express + TS + Sequelize + Vite React)
2. Database schema + migrations + seed data
3. Store management API + operator dashboard
4. Shopping session API + kiosk frontend
5. Stripe integration (test mode)
6. Transaction history

### Phase 2: Make it reliable (V2)
7. Idempotency middleware
8. Circuit breaker + retry utilities
9. Background jobs (pg-boss) for notifications
10. Inventory event sourcing + optimistic locking
11. Rate limiting
12. Structured logging + correlation IDs
13. Health check endpoints
14. Graceful degradation

### Phase 3: Polish
15. Load test script
16. README + architecture docs
17. Heroku deployment config
18. Final review pass

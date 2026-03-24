# Load Tests

Smoke tests using [k6](https://k6.io) that exercise the full TinyMart API under realistic traffic.

## Prerequisites

- k6 installed: `brew install k6` (macOS) or see [k6 installation](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- TinyMart running locally with seeded data (`bun run dev` + `bun run db:seed`)

## Running

```bash
# Get the demo operator's API key
API_KEY=$(psql "$DATABASE_URL" -t -c "SELECT api_key FROM operators LIMIT 1" | tr -d ' ')

# Run the smoke test
k6 run -e API_KEY="$API_KEY" load-tests/smoke.js

# Or point at a deployed instance
k6 run -e API_KEY="$API_KEY" -e BASE_URL="https://your-app.herokuapp.com" load-tests/smoke.js
```

## Scenarios

| Scenario | Duration | What it tests |
|----------|----------|---------------|
| `health_poller` | 60s, 2 req/s | Liveness and readiness endpoints |
| `operator_flow` | 3 VUs × 5 iterations | Create products, add to stores, idempotency replay |
| `read_traffic` | 60s, 10 req/s | GET stores and products under sustained load |
| `rate_limit_burst` | Starts at 30s | Fires 120 rapid requests to trigger 429 + Retry-After |

## Thresholds

- `http_req_duration` p95 < 500ms, p99 < 1s
- `api_error_rate` < 5%
- `health_check_latency` p95 < 100ms

If any threshold is breached, k6 exits with a non-zero code.

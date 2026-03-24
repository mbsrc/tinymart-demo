# Plan 15: Load Testing

## Goal
Provide a k6 load test script that exercises the full API surface under realistic traffic. Demonstrates the reliability patterns (rate limiting, idempotency, circuit breaker) under load.

## Sub-steps

### 15a. k6 smoke test script
Create `load-tests/smoke.js` with scenarios:

1. **Health checks** — constant polling of `/health` and `/health/ready`
2. **Operator flow** — create product → list stores → add product to store → adjust inventory
3. **Read-heavy traffic** — GET stores, products, event history (realistic read:write ratio)
4. **Rate limit trigger** — burst of requests to verify 429s and `Retry-After` headers

Script accepts `API_KEY` and `BASE_URL` env vars. Includes k6 thresholds for p95 latency and error rate.

### 15b. Package script + README
- Add `load-test` script to `package.json`
- Create `load-tests/README.md` with setup and run instructions

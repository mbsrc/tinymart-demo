import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js"
import { check, group, sleep } from "k6"
import http from "k6/http"
import { Counter, Rate, Trend } from "k6/metrics"

// --- Configuration ---

const BASE_URL = __ENV.BASE_URL || "http://localhost:3001"
const API_KEY = __ENV.API_KEY

if (!API_KEY) {
  throw new Error("API_KEY env var is required. Run: k6 run -e API_KEY=<key> smoke.js")
}

const headers = {
  "Content-Type": "application/json",
  "x-api-key": API_KEY,
}

// --- Custom metrics ---

const rateLimited = new Counter("rate_limited_responses")
const idempotencyHits = new Counter("idempotency_cache_hits")
const apiErrors = new Rate("api_error_rate")
const healthLatency = new Trend("health_check_latency", true)

// --- Scenarios ---

export const options = {
  scenarios: {
    health_poller: {
      executor: "constant-arrival-rate",
      rate: 2,
      timeUnit: "1s",
      duration: "60s",
      preAllocatedVUs: 2,
      exec: "healthChecks",
    },
    operator_flow: {
      executor: "per-vu-iterations",
      vus: 3,
      iterations: 5,
      startTime: "2s",
      exec: "operatorFlow",
    },
    read_traffic: {
      executor: "constant-arrival-rate",
      rate: 10,
      timeUnit: "1s",
      duration: "60s",
      preAllocatedVUs: 5,
      startTime: "5s",
      exec: "readTraffic",
    },
    rate_limit_burst: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      startTime: "30s",
      exec: "rateLimitBurst",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1000"],
    api_error_rate: ["rate<0.05"],
    health_check_latency: ["p(95)<100"],
  },
}

// --- Scenario: Health checks ---

export function healthChecks() {
  group("health", () => {
    const liveness = http.get(`${BASE_URL}/health`)
    healthLatency.add(liveness.timings.duration)
    check(liveness, {
      "GET /health returns 200": (r) => r.status === 200,
      "liveness status is ok": (r) => r.json("data.status") === "ok",
    })

    const readiness = http.get(`${BASE_URL}/health/ready`)
    healthLatency.add(readiness.timings.duration)
    check(readiness, {
      "GET /health/ready returns 200 or 503": (r) => r.status === 200 || r.status === 503,
    })
  })
}

// --- Scenario: Operator flow (write-heavy) ---

export function operatorFlow() {
  const idempotencyKey = uuidv4()

  group("operator", () => {
    // List existing stores
    const stores = http.get(`${BASE_URL}/api/stores`, { headers })
    check(stores, {
      "list stores succeeds": (r) => r.status === 200,
    })
    apiErrors.add(stores.status >= 500)

    const storeList = stores.json("data")
    if (!storeList || storeList.length === 0) {
      return
    }
    const storeId = storeList[0].id

    // Create a product
    const createBody = JSON.stringify({
      name: `Load Test Item ${uuidv4().slice(0, 8)}`,
      sku: `LT-${uuidv4().slice(0, 8)}`,
      price_cents: Math.floor(Math.random() * 900) + 100,
      category: "pantry",
    })
    const createRes = http.post(`${BASE_URL}/api/products`, createBody, {
      headers: { ...headers, "Idempotency-Key": idempotencyKey },
    })
    check(createRes, {
      "create product returns 201": (r) => r.status === 201,
    })
    apiErrors.add(createRes.status >= 500)

    if (createRes.status !== 201) return

    const productId = createRes.json("data.id")

    // Replay same request — should get idempotency cache hit
    const replay = http.post(`${BASE_URL}/api/products`, createBody, {
      headers: { ...headers, "Idempotency-Key": idempotencyKey },
    })
    if (replay.status === 200) {
      idempotencyHits.add(1)
    }
    check(replay, {
      "idempotency replay returns 200 (cached)": (r) => r.status === 200,
    })

    // Add product to store
    const addKey = uuidv4()
    const addRes = http.post(
      `${BASE_URL}/api/stores/${storeId}/products`,
      JSON.stringify({ product_id: productId, quantity_on_hand: 10 }),
      { headers: { ...headers, "Idempotency-Key": addKey } },
    )
    check(addRes, {
      "add product to store succeeds": (r) => r.status === 201 || r.status === 409,
    })
    apiErrors.add(addRes.status >= 500)

    // Get store detail with products
    const detail = http.get(`${BASE_URL}/api/stores/${storeId}`, { headers })
    check(detail, {
      "store detail returns 200": (r) => r.status === 200,
      "store has products": (r) => {
        const data = r.json("data")
        return data?.StoreProducts?.length > 0
      },
    })
    apiErrors.add(detail.status >= 500)
  })

  sleep(1)
}

// --- Scenario: Read-heavy traffic ---

export function readTraffic() {
  group("reads", () => {
    const endpoint = Math.random() > 0.5 ? "/api/stores" : "/api/products"
    const res = http.get(`${BASE_URL}${endpoint}`, { headers })
    check(res, {
      "read endpoint returns 200": (r) => r.status === 200,
    })
    apiErrors.add(res.status >= 500)

    if (res.status === 429) {
      rateLimited.add(1)
    }
  })
}

// --- Scenario: Rate limit burst ---

export function rateLimitBurst() {
  group("rate_limit_burst", () => {
    let got429 = false
    let hasRetryAfter = false

    // Fire 120 requests quickly — default limit is 100/min
    for (let i = 0; i < 120; i++) {
      const res = http.get(`${BASE_URL}/api/stores`, { headers })

      if (res.status === 429) {
        got429 = true
        rateLimited.add(1)
        if (res.headers["Retry-After"]) {
          hasRetryAfter = true
        }
        break
      }
    }

    check(null, {
      "rate limiter triggered 429": () => got429,
      "429 includes Retry-After header": () => hasRetryAfter,
    })
  })
}

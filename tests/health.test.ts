import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { sequelize } from "../src/models/index.js"

beforeAll(async () => {
  await sequelize.sync({ force: true })
})

afterAll(async () => {
  await sequelize.close()
})

describe("Health endpoints", () => {
  it("GET /health returns 200 with envelope", async () => {
    const res = await request(app).get("/health")

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe("ok")
    expect(res.body.error).toBeNull()
    expect(res.body.meta.correlation_id).toBeDefined()
    expect(res.body.meta.timestamp).toBeDefined()
  })

  it("GET /health preserves client correlation ID", async () => {
    const correlationId = "test-correlation-123"
    const res = await request(app).get("/health").set("x-correlation-id", correlationId)

    expect(res.body.meta.correlation_id).toBe(correlationId)
    expect(res.headers["x-correlation-id"]).toBe(correlationId)
  })

  it("GET /health/ready checks database connectivity", async () => {
    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("ready")
    expect(res.body.data.checks.database).toBe("ok")
  })

  it("GET /health/detailed returns circuit breaker status", async () => {
    const res = await request(app).get("/health/detailed")

    expect(res.status).toBe(200)
    expect(res.body.data.circuit_breakers).toBeDefined()
    expect(res.body.data.circuit_breakers.stripe).toBeDefined()
    expect(res.body.data.circuit_breakers.stripe.state).toBe("closed")
    expect(res.body.data.circuit_breakers.stripe.failureCount).toBe(0)
    expect(res.body.data.circuit_breakers.stripe.lastFailureTime).toBeNull()
    expect(res.body.data.circuit_breakers.stripe.nextRetryTime).toBeNull()
  })

  it("GET /health/detailed returns uptime and memory", async () => {
    const res = await request(app).get("/health/detailed")

    expect(res.body.data.uptime).toBeGreaterThan(0)
    expect(res.body.data.memory).toBeDefined()
    expect(res.body.data.memory.heapUsed).toBeGreaterThan(0)
  })

  it("returns 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/nonexistent")

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })
})

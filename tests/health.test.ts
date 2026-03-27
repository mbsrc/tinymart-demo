import { randomUUID } from "node:crypto"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { Operator, sequelize } from "../src/models/index.js"
import { dependencyRegistry } from "../src/services/dependencyRegistry.js"

let apiHeaders: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Health Op",
    email: "health@example.com",
    api_key: `key-${randomUUID()}`,
  })
  apiHeaders = {
    "x-api-key": op.api_key,
    "Content-Type": "application/json",
  }

  // Register test dependencies so health endpoints have something to check
  dependencyRegistry.register("database", async () => {
    await sequelize.authenticate()
    return "healthy"
  })
  dependencyRegistry.register("stripe", async () => "healthy")
  dependencyRegistry.register("job_queue", async () => "healthy")
})

afterAll(async () => {
  dependencyRegistry.stopMonitoring()
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

  it("GET /health/ready returns ready when all deps healthy", async () => {
    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("ready")
    expect(res.body.data.checks.database).toBe("healthy")
    expect(res.body.data.checks.stripe).toBe("healthy")
    expect(res.body.data.checks.job_queue).toBe("healthy")
  })

  it("GET /health/ready returns degraded when non-critical dep is down", async () => {
    // Override stripe to return unavailable
    dependencyRegistry.register("stripe", async () => "unavailable")

    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("degraded")
    expect(res.body.data.checks.database).toBe("healthy")
    expect(res.body.data.checks.stripe).toBe("unavailable")

    // Restore
    dependencyRegistry.register("stripe", async () => "healthy")
  })

  it("GET /health/ready returns 503 when database is down", async () => {
    dependencyRegistry.register("database", async () => "unavailable")

    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(503)
    expect(res.body.data.status).toBe("unavailable")

    // Restore
    dependencyRegistry.register("database", async () => {
      await sequelize.authenticate()
      return "healthy"
    })
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

  it("GET /health/detailed returns dependency registry statuses", async () => {
    const res = await request(app).get("/health/detailed")

    expect(res.body.data.dependencies).toBeDefined()
    expect(res.body.data.dependencies.database.status).toBe("healthy")
    expect(res.body.data.dependencies.stripe.status).toBe("healthy")
    expect(res.body.data.dependencies.job_queue.status).toBe("healthy")
  })

  it("GET /health/detailed returns job queue status", async () => {
    const res = await request(app).get("/health/detailed")

    // pg-boss isn't started in tests, so status should be not_started
    expect(res.body.data.job_queue).toBeDefined()
    expect(res.body.data.job_queue.status).toBe("not_started")
  })

  it("GET /health/detailed returns uptime and memory", async () => {
    const res = await request(app).get("/health/detailed")

    expect(res.body.data.uptime).toBeGreaterThan(0)
    expect(res.body.data.memory).toBeDefined()
    expect(res.body.data.memory.heap_used).toBeGreaterThan(0)
  })

  it("returns 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/nonexistent")

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })

  it("echoes correlation ID on API routes", async () => {
    const res = await request(app)
      .get("/api/stores")
      .set({ ...apiHeaders, "X-Correlation-ID": "test-api-corr" })

    expect(res.headers["x-correlation-id"]).toBe("test-api-corr")
    expect(res.body.meta.correlation_id).toBe("test-api-corr")
  })

  it("auto-generates UUID correlation ID when no header sent", async () => {
    const res = await request(app).get("/api/stores").set(apiHeaders)

    const id = res.body.meta.correlation_id
    expect(id).toBeDefined()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })
})

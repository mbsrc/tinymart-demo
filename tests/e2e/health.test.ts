import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { dependencyRegistry } from "../../src/services/dependencyRegistry.js"
import { app, createOperator, request, sequelize } from "./helpers.js"

let headers: Record<string, string>

beforeAll(async () => {
  await sequelize.sync({ force: true })
  const ctx = await createOperator("Health Op")
  headers = ctx.headers

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

describe("Health and diagnostics", () => {
  describe("Liveness", () => {
    it("GET /health returns 200 with status ok", async () => {
      const res = await request(app).get("/health")

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe("ok")
    })
  })

  describe("Readiness", () => {
    it("GET /health/ready returns 200 with dependency checks", async () => {
      const res = await request(app).get("/health/ready")

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe("ready")
      expect(res.body.data.checks).toHaveProperty("database")
      expect(res.body.data.checks).toHaveProperty("stripe")
      expect(res.body.data.checks).toHaveProperty("job_queue")
    })
  })

  describe("Detailed diagnostics", () => {
    it("GET /health/detailed returns system info", async () => {
      const res = await request(app).get("/health/detailed")

      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty("circuit_breakers")
      expect(res.body.data).toHaveProperty("dependencies")
      expect(res.body.data.uptime).toBeGreaterThan(0)
      expect(res.body.data.memory.rss).toBeGreaterThan(0)
      expect(res.body.data.memory.heapUsed).toBeGreaterThan(0)
    })
  })

  describe("Correlation ID round-trip", () => {
    it("echoes back a provided X-Correlation-ID", async () => {
      const res = await request(app)
        .get("/api/stores")
        .set({ ...headers, "X-Correlation-ID": "test-123" })

      expect(res.headers["x-correlation-id"]).toBe("test-123")
      expect(res.body.meta.correlation_id).toBe("test-123")
    })

    it("auto-generates a UUID when no header is sent", async () => {
      const res = await request(app).get("/api/stores").set(headers)

      const id = res.body.meta.correlation_id
      expect(id).toBeDefined()
      expect(id).toMatch(/^[0-9a-f-]{36}$/)
    })
  })

  describe("404 returns proper envelope", () => {
    it("GET /api/nonexistent returns 404 with NOT_FOUND envelope", async () => {
      const res = await request(app).get("/api/nonexistent").set(headers)

      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe("NOT_FOUND")
    })
  })
})

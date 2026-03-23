import request from "supertest"
import { describe, expect, it } from "vitest"
import { app } from "../src/app.js"

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

  it("returns 404 envelope for unknown routes", async () => {
    const res = await request(app).get("/nonexistent")

    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe("NOT_FOUND")
  })
})

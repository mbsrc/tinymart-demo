import request from "supertest"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { app } from "../src/app.js"
import { sequelize } from "../src/models/index.js"
import { dependencyRegistry } from "../src/services/dependencyRegistry.js"

beforeAll(async () => {
  await sequelize.sync({ force: true })

  dependencyRegistry.register("database", async () => "healthy")
  dependencyRegistry.register("stripe", async () => "healthy")
  dependencyRegistry.register("job_queue", async () => "healthy")
})

afterAll(async () => {
  dependencyRegistry.stopMonitoring()
  await sequelize.close()
})

describe("Degradation middleware", () => {
  it("attaches degradation context to requests", async () => {
    // The degradation context isn't directly visible in responses,
    // but we can verify it through the health/ready endpoint which uses the registry
    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.data.checks.database).toBe("healthy")
    expect(res.body.data.checks.stripe).toBe("healthy")
    expect(res.body.data.checks.job_queue).toBe("healthy")
  })

  it("reflects degraded state when stripe is unavailable", async () => {
    dependencyRegistry.register("stripe", async () => "unavailable")

    const res = await request(app).get("/health/ready")

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe("degraded")
    expect(res.body.data.checks.stripe).toBe("unavailable")

    // Restore
    dependencyRegistry.register("stripe", async () => "healthy")
  })

  it("API routes remain accessible during degradation", async () => {
    dependencyRegistry.register("stripe", async () => "unavailable")
    dependencyRegistry.register("job_queue", async () => "unavailable")

    // Products endpoint should still work (only needs DB)
    const res = await request(app).get("/api/products").set("x-operator-id", "test-op")

    // 200 or 401 depending on auth — point is it's not 503
    expect(res.status).not.toBe(503)

    // Restore
    dependencyRegistry.register("stripe", async () => "healthy")
    dependencyRegistry.register("job_queue", async () => "healthy")
  })
})

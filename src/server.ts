import { initSentry } from "./utils/sentry.js"
initSentry()

import { app } from "./app.js"
import { config } from "./config/index.js"
import { getJobQueue, startJobQueue, stopJobQueue } from "./jobs/queue.js"
import { sequelize } from "./models/index.js"
import { dependencyRegistry } from "./services/dependencyRegistry.js"
import { stripeCircuitBreaker } from "./services/stripe.js"
import type { CircuitState } from "./utils/circuitBreaker.js"
import { logger } from "./utils/logger.js"

const CIRCUIT_STATE_TO_STATUS: Record<CircuitState, "healthy" | "degraded" | "unavailable"> = {
  closed: "healthy",
  half_open: "degraded",
  open: "unavailable",
}

function registerDependencies(): void {
  dependencyRegistry.register("database", async () => {
    await sequelize.authenticate()
    return "healthy"
  })

  dependencyRegistry.register("stripe", async () => {
    return CIRCUIT_STATE_TO_STATUS[stripeCircuitBreaker.getState()]
  })

  dependencyRegistry.register("job_queue", async () => {
    const boss = getJobQueue()
    if (!boss) return "unavailable"
    // pg-boss exposes no lightweight ping — if we got here, the instance exists and started
    return "healthy"
  })
}

const server = app.listen(config.port, async () => {
  logger.info(`TinyMart API listening on port ${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
  })

  try {
    await startJobQueue()
  } catch (error) {
    logger.error("Failed to start job queue", {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  registerDependencies()
  dependencyRegistry.startMonitoring()
})

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)
  dependencyRegistry.stopMonitoring()

  server.close(async () => {
    await stopJobQueue()
    process.exit(0)
  })

  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 15_000)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

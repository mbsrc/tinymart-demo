import { app } from "./app.js"
import { config } from "./config/index.js"
import { startJobQueue, stopJobQueue } from "./jobs/queue.js"
import { logger } from "./utils/logger.js"

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
})

async function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`)

  server.close(async () => {
    await stopJobQueue()
    process.exit(0)
  })

  // Force exit after 15s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 15_000)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))

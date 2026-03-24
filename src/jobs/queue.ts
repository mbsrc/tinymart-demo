import { PgBoss } from "pg-boss"
import { config } from "../config/index.js"
import { logger } from "../utils/logger.js"
import { registerHandlers } from "./handlers/index.js"

let boss: PgBoss | null = null

export async function startJobQueue(): Promise<PgBoss> {
  boss = new PgBoss({
    connectionString: config.databaseUrl,
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInHours: 1,
    archiveCompletedAfterSeconds: 3600,
    deleteAfterDays: 7,
  })

  boss.on("error", (error) => {
    logger.error("pg-boss error", {
      error: error instanceof Error ? error.message : JSON.stringify(error),
    })
  })

  await boss.start()
  logger.info("pg-boss job queue started")

  await registerHandlers(boss)

  return boss
}

export async function stopJobQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10_000 })
    logger.info("pg-boss job queue stopped")
    boss = null
  }
}

export function getJobQueue(): PgBoss | null {
  return boss
}

import * as Sentry from "@sentry/node"
import { config } from "../config/index.js"

export function initSentry() {
  if (!config.betterStackErrorsDsn) return

  Sentry.init({
    dsn: config.betterStackErrorsDsn,
    environment: config.nodeEnv,
  })
}

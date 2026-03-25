import { Logtail } from "@logtail/node"
import { config } from "../config/index.js"

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
}

function createLogger(): Logger {
  const logtail = config.betterStackSourceToken
    ? new Logtail(config.betterStackSourceToken, { endpoint: config.betterStackIngestingHost })
    : null

  function log(level: "info" | "warn" | "error", message: string, context?: LogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }

    const output = JSON.stringify(entry)
    if (level === "error") {
      process.stderr.write(`${output}\n`)
    } else {
      process.stdout.write(`${output}\n`)
    }

    // Graceful degradation: BetterStack is best-effort
    if (logtail) {
      logtail[level](message, context).catch(() => {})
    }
  }

  return {
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
  }
}

export const logger = createLogger()

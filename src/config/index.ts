import "dotenv/config"

interface Config {
  databaseUrl: string
  stripeSecretKey: string
  stripeWebhookSecret: string | undefined
  port: number
  nodeEnv: string
  betterStackSourceToken: string | undefined
  betterStackIngestingHost: string | undefined
  betterStackErrorsDsn: string | undefined
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
  corsAllowedOrigins: string[]
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function loadConfig(): Config {
  return {
    databaseUrl: requireEnv("DATABASE_URL"),
    stripeSecretKey: requireEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    port: Number.parseInt(requireEnv("PORT"), 10),
    nodeEnv: requireEnv("NODE_ENV"),
    betterStackSourceToken: process.env.BETTERSTACK_SOURCE_TOKEN,
    betterStackIngestingHost: process.env.BETTERSTACK_INGESTING_HOST,
    betterStackErrorsDsn: process.env.BETTERSTACK_ERRORS_DSN,
    rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    rateLimitMaxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
    corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : ["*"],
  }
}

export const config = loadConfig()
export type { Config }

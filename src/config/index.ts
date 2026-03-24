import "dotenv/config"

interface Config {
  databaseUrl: string
  stripeSecretKey: string
  stripeWebhookSecret: string | undefined
  port: number
  nodeEnv: string
  betterStackSourceToken: string | undefined
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
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
    rateLimitWindowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
    rateLimitMaxRequests: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
  }
}

export const config = loadConfig()
export type { Config }

import type { NextFunction, Request, Response } from "express"
import { config } from "../config/index.js"
import { buildMeta, errorEnvelope } from "../utils/envelope.js"
import { logger } from "../utils/logger.js"

interface SlidingWindowEntry {
  timestamps: number[]
}

// In-memory sliding window store — keyed by API key or IP
const windows = new Map<string, SlidingWindowEntry>()

// Periodic cleanup of expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60_000
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function startCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - config.rateLimitWindowMs
    for (const [key, entry] of windows) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
      if (entry.timestamps.length === 0) windows.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  cleanupTimer.unref()
}

function getClientKey(req: Request): string {
  const apiKey = req.headers["x-api-key"] as string | undefined
  if (apiKey) return `key:${apiKey}`
  return `ip:${req.ip ?? "unknown"}`
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  startCleanup()

  const key = getClientKey(req)
  const now = Date.now()
  const windowStart = now - config.rateLimitWindowMs

  let entry = windows.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    windows.set(key, entry)
  }

  // Slide the window: drop timestamps older than the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= config.rateLimitMaxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfterMs = oldestInWindow + config.rateLimitWindowMs - now
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)

    logger.warn("Rate limit exceeded", {
      correlationId: req.correlationId,
      key,
      count: entry.timestamps.length,
      windowMs: config.rateLimitWindowMs,
    })

    res.setHeader("Retry-After", retryAfterSec)
    res.setHeader("X-RateLimit-Limit", config.rateLimitMaxRequests)
    res.setHeader("X-RateLimit-Remaining", 0)
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil((oldestInWindow + config.rateLimitWindowMs) / 1000),
    )

    res.status(429).json(
      errorEnvelope(
        {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests, please try again later",
          retry_after: retryAfterSec,
        },
        buildMeta(req),
      ),
    )
    return
  }

  entry.timestamps.push(now)

  // Set rate limit headers on all responses
  res.setHeader("X-RateLimit-Limit", config.rateLimitMaxRequests)
  res.setHeader("X-RateLimit-Remaining", config.rateLimitMaxRequests - entry.timestamps.length)

  next()
}

// Exposed for testing
export function resetRateLimiter(): void {
  windows.clear()
}

import type { Request, Response } from "express"
import { Router } from "express"
import { getJobQueue } from "../jobs/queue.js"
import { JobFailure } from "../models/index.js"
import { dependencyRegistry } from "../services/dependencyRegistry.js"
import { stripeCircuitBreaker } from "../services/stripe.js"
import { envelope } from "../utils/envelope.js"

const router = Router()

// Liveness — is the process running?
router.get("/health", (req: Request, res: Response) => {
  res.json(
    envelope(
      { status: "ok" },
      { correlation_id: req.correlationId, timestamp: new Date().toISOString() },
    ),
  )
})

// Readiness — can we serve traffic?
// Returns 200 if database is up (core dependency). Non-critical deps (Stripe, job queue)
// being down results in status "degraded" but still 200 — the app can serve in reduced capacity.
router.get("/health/ready", async (req: Request, res: Response) => {
  await dependencyRegistry.checkAll()
  const statuses = dependencyRegistry.getAllStatuses()

  const dbHealthy = statuses.database?.status === "healthy"
  const allHealthy = Object.values(statuses).every((s) => s.status === "healthy")

  let status: string
  let statusCode: number

  if (!dbHealthy) {
    status = "unavailable"
    statusCode = 503
  } else if (!allHealthy) {
    status = "degraded"
    statusCode = 200
  } else {
    status = "ready"
    statusCode = 200
  }

  const checks = Object.fromEntries(
    Object.entries(statuses).map(([name, info]) => [name, info.status]),
  )

  res
    .status(statusCode)
    .json(
      envelope(
        { status, checks },
        { correlation_id: req.correlationId, timestamp: new Date().toISOString() },
      ),
    )
})

// Detailed — full diagnostics
router.get("/health/detailed", async (req: Request, res: Response) => {
  await dependencyRegistry.checkAll()
  const statuses = dependencyRegistry.getAllStatuses()

  const dbHealthy = statuses.database?.status === "healthy"
  const allHealthy = Object.values(statuses).every((s) => s.status === "healthy")
  const statusCode = dbHealthy ? 200 : 503

  const boss = getJobQueue()
  let jobQueue: Record<string, unknown> = { status: "not_started" }

  if (boss) {
    try {
      const queues = await boss.getQueues()
      const deadLetterCount = await JobFailure.count()
      jobQueue = {
        status: "running",
        queues: queues.map((q) => ({ name: q.name, policy: q.policy })),
        dead_letter_count: deadLetterCount,
      }
    } catch {
      jobQueue = { status: "error" }
    }
  }

  res.status(statusCode).json(
    envelope(
      {
        status: allHealthy ? "healthy" : "degraded",
        dependencies: statuses,
        circuit_breakers: {
          stripe: stripeCircuitBreaker.getStatus(),
        },
        job_queue: jobQueue,
        uptime: process.uptime(),
        memory: (() => {
          const mem = process.memoryUsage()
          return { rss: mem.rss, heap_used: mem.heapUsed, heap_total: mem.heapTotal }
        })(),
      },
      { correlation_id: req.correlationId, timestamp: new Date().toISOString() },
    ),
  )
})

export { router as healthRouter }

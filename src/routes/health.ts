import type { Request, Response } from "express"
import { Router } from "express"
import { getJobQueue } from "../jobs/queue.js"
import { JobFailure, sequelize } from "../models/index.js"
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
router.get("/health/ready", async (req: Request, res: Response) => {
  const checks: Record<string, string> = {}

  try {
    await sequelize.authenticate()
    checks.database = "ok"
  } catch {
    checks.database = "unavailable"
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok")
  const statusCode = allHealthy ? 200 : 503

  res
    .status(statusCode)
    .json(
      envelope(
        { status: allHealthy ? "ready" : "degraded", checks },
        { correlation_id: req.correlationId, timestamp: new Date().toISOString() },
      ),
    )
})

// Detailed — full diagnostics
router.get("/health/detailed", async (req: Request, res: Response) => {
  const checks: Record<string, string> = {}

  try {
    await sequelize.authenticate()
    checks.database = "ok"
  } catch {
    checks.database = "unavailable"
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok")
  const statusCode = allHealthy ? 200 : 503

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
        checks,
        circuit_breakers: {
          stripe: stripeCircuitBreaker.getStatus(),
        },
        job_queue: jobQueue,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      { correlation_id: req.correlationId, timestamp: new Date().toISOString() },
    ),
  )
})

export { router as healthRouter }

import * as Sentry from "@sentry/node"
import type { NextFunction, Request, Response } from "express"
import { AppError } from "../types/index.js"
import { errorEnvelope } from "../utils/envelope.js"
import { logger } from "../utils/logger.js"

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = req.correlationId ?? "unknown"

  if (err instanceof AppError) {
    logger.error(err.message, {
      correlationId,
      code: err.code,
      statusCode: err.statusCode,
    })

    // Non operational errors should be logged to Sentry
    if (err.statusCode >= 500) {
      Sentry.captureException(err, {
        tags: { correlation_id: correlationId, code: err.code },
      })
    }

    res
      .status(err.statusCode)
      .json(
        errorEnvelope(
          { code: err.code, message: err.message },
          { correlation_id: correlationId, timestamp: new Date().toISOString() },
        ),
      )
    return
  }

  // Handle unexpected errors
  logger.error(err.message, {
    correlationId,
    stack: err.stack,
  })

  Sentry.captureException(err, {
    tags: { correlation_id: correlationId },
  })

  res
    .status(500)
    .json(
      errorEnvelope(
        { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        { correlation_id: correlationId, timestamp: new Date().toISOString() },
      ),
    )
}

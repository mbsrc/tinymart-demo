import type { NextFunction, Request, Response } from "express"
import { logger } from "../utils/logger.js"

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()

  res.on("finish", () => {
    const duration = Date.now() - start
    logger.info(`${req.method} ${req.path} ${res.statusCode}`, {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    })
  })

  next()
}

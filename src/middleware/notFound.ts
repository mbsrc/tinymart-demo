import type { NextFunction, Request, Response } from "express"
import { errorEnvelope } from "../utils/envelope.js"

export function notFound(req: Request, res: Response, _next: NextFunction): void {
  res
    .status(404)
    .json(
      errorEnvelope(
        { code: "NOT_FOUND", message: `${req.method} ${req.path} not found` },
        { correlation_id: req.correlationId ?? "unknown", timestamp: new Date().toISOString() },
      ),
    )
}

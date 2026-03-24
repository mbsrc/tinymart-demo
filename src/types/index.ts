export interface ErrorDetail {
  code: string
  message: string
  retry_after?: number
}

export interface ResponseMeta {
  correlation_id: string
  timestamp: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  error: ErrorDetail | null
  meta: ResponseMeta
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: string
  readonly isOperational: boolean

  constructor(statusCode: number, code: string, message: string, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

declare module "express-serve-static-core" {
  interface Request {
    correlationId: string
    idempotencyKey?: string
    operator?: import("../models/Operator.js").Operator
    degradation?: import("../middleware/degradation.js").DegradationContext
  }
}

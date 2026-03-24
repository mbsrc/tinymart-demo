import type { NextFunction, Request, Response } from "express"
import { type DependencyStatus, dependencyRegistry } from "../services/dependencyRegistry.js"

export interface DegradationContext {
  database: DependencyStatus
  stripe: DependencyStatus
  job_queue: DependencyStatus
}

export function degradation(req: Request, _res: Response, next: NextFunction): void {
  req.degradation = {
    database: dependencyRegistry.getStatus("database"),
    stripe: dependencyRegistry.getStatus("stripe"),
    job_queue: dependencyRegistry.getStatus("job_queue"),
  }
  next()
}

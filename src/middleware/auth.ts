import type { NextFunction, Request, Response } from "express"
import type { Operator as OperatorModel } from "../models/Operator.js"
import { Operator } from "../models/index.js"
import { AppError } from "../types/index.js"

export function getOperator(req: Request): OperatorModel {
  const op = req.operator
  if (!op) throw new AppError(401, "UNAUTHORIZED", "Not authenticated")
  return op
}

export async function authenticateOperator(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const apiKey = req.headers["x-api-key"]
    if (!apiKey || typeof apiKey !== "string") {
      throw new AppError(401, "UNAUTHORIZED", "Missing x-api-key header")
    }

    const operator = await Operator.findOne({ where: { api_key: apiKey } })
    if (!operator) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid API key")
    }

    req.operator = operator
    next()
  } catch (error) {
    next(error)
  }
}

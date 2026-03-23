import type { NextFunction, Request, Response } from "express"
import { Op } from "sequelize"
import { IdempotencyKey } from "../models/index.js"
import { AppError } from "../types/index.js"
import { hashBody } from "../utils/hashBody.js"
import { logger } from "../utils/logger.js"

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (SAFE_METHODS.has(req.method)) {
      next()
      return
    }

    const key = req.headers["idempotency-key"]
    if (!key || typeof key !== "string") {
      throw new AppError(
        400,
        "MISSING_IDEMPOTENCY_KEY",
        "Idempotency-Key header is required for mutation requests",
      )
    }

    if (key.length > 255) {
      throw new AppError(
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must not exceed 255 characters",
      )
    }

    const bodyHash = hashBody(req.body)
    const requestPath = `${req.method} ${req.baseUrl}${req.path}`

    const existing = await IdempotencyKey.findOne({
      where: {
        key,
        expires_at: { [Op.gt]: new Date() },
      },
    })

    if (existing) {
      if (existing.request_body_hash !== bodyHash) {
        throw new AppError(
          422,
          "IDEMPOTENCY_BODY_MISMATCH",
          "Request body does not match the original request for this idempotency key",
        )
      }

      if (existing.request_path !== requestPath) {
        throw new AppError(
          422,
          "IDEMPOTENCY_PATH_MISMATCH",
          "Idempotency key was used on a different endpoint",
        )
      }

      if (existing.response_status === null || existing.response_body === null) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_IN_PROGRESS",
          "A request with this idempotency key is currently being processed",
        )
      }

      res.status(existing.response_status).json(existing.response_body)
      return
    }

    // Clean up any expired row with this key so the PK slot is available
    await IdempotencyKey.destroy({
      where: { key, expires_at: { [Op.lte]: new Date() } },
    })

    try {
      await IdempotencyKey.create({
        key,
        request_path: requestPath,
        request_body_hash: bodyHash,
        response_status: null,
        response_body: null,
        expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      })
    } catch (error) {
      if (
        error instanceof Error &&
        "name" in error &&
        error.name === "SequelizeUniqueConstraintError"
      ) {
        throw new AppError(
          409,
          "IDEMPOTENCY_KEY_IN_PROGRESS",
          "A request with this idempotency key is currently being processed",
        )
      }
      throw error
    }

    const originalJson = res.json.bind(res)
    res.json = ((body: unknown) => {
      const status = res.statusCode

      if (status < 500) {
        IdempotencyKey.update(
          {
            response_status: status,
            response_body: body as Record<string, unknown>,
          },
          { where: { key } },
        ).catch((err: unknown) => {
          logger.error("Failed to cache idempotency response", {
            idempotency_key: key,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      } else {
        IdempotencyKey.destroy({ where: { key } }).catch((err: unknown) => {
          logger.error("Failed to clean up failed idempotency key", {
            idempotency_key: key,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }

      return originalJson(body)
    }) as Response["json"]

    req.idempotencyKey = key
    next()
  } catch (error) {
    next(error)
  }
}

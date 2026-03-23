import { Router } from "express"
import { getOperator } from "../middleware/auth.js"
import { Product } from "../models/index.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"

const router = Router()

const VALID_CATEGORIES = ["pantry", "fridge", "freezer"] as const

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, sku, price_cents, category, image_url } = req.body

    if (!name || typeof name !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "name is required")
    }
    if (!sku || typeof sku !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "sku is required")
    }
    if (!Number.isInteger(price_cents) || price_cents <= 0) {
      throw new AppError(400, "VALIDATION_ERROR", "price_cents must be a positive integer")
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "category must be one of: pantry, fridge, freezer",
      )
    }

    try {
      const product = await Product.create({
        operator_id: getOperator(req).id,
        name,
        sku,
        price_cents,
        category,
        image_url: image_url ?? null,
      })
      res.status(201).json(envelope(product, buildMeta(req)))
    } catch (error) {
      if (
        error instanceof Error &&
        "name" in error &&
        error.name === "SequelizeUniqueConstraintError"
      ) {
        throw new AppError(409, "DUPLICATE_SKU", "A product with this SKU already exists")
      }
      throw error
    }
  }),
)

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { operator_id: getOperator(req).id }

    const { category } = req.query
    if (category && typeof category === "string") {
      if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid category filter")
      }
      where.category = category
    }

    const products = await Product.findAll({ where })
    res.json(envelope(products, buildMeta(req)))
  }),
)

export { router as productsRouter }

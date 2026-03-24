import { Router } from "express"
import { getOperator } from "../middleware/auth.js"
import { Product, Store, StoreProduct } from "../models/index.js"
import { adjustInventory, getEventHistory } from "../services/inventory.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"

const router = Router()

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { name, location_name, address } = req.body

    if (!name || typeof name !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "name is required")
    }

    const store = await Store.create({
      operator_id: getOperator(req).id,
      name,
      location_name: location_name ?? null,
      address: address ?? null,
    })
    res.status(201).json(envelope(store, buildMeta(req)))
  }),
)

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const stores = await Store.findAll({
      where: { operator_id: getOperator(req).id },
    })
    res.json(envelope(stores, buildMeta(req)))
  }),
)

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const storeId = req.params.id as string
    const store = await Store.findByPk(storeId, {
      include: [{ model: StoreProduct, include: [Product] }],
    })

    if (!store || store.operator_id !== getOperator(req).id) {
      throw new AppError(404, "STORE_NOT_FOUND", "Store not found")
    }

    res.json(envelope(store, buildMeta(req)))
  }),
)

router.post(
  "/:id/products",
  asyncHandler(async (req, res) => {
    const storeId = req.params.id as string
    const store = await Store.findByPk(storeId)
    if (!store || store.operator_id !== getOperator(req).id) {
      throw new AppError(404, "STORE_NOT_FOUND", "Store not found")
    }

    const { product_id, quantity_on_hand, low_stock_threshold } = req.body
    if (!product_id || typeof product_id !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "product_id is required")
    }

    const product = await Product.findByPk(product_id)
    if (!product || product.operator_id !== getOperator(req).id) {
      throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found")
    }

    try {
      const storeProduct = await StoreProduct.create({
        store_id: store.id,
        product_id,
        quantity_on_hand: quantity_on_hand ?? undefined,
        low_stock_threshold: low_stock_threshold ?? undefined,
      })
      res.status(201).json(envelope(storeProduct, buildMeta(req)))
    } catch (error) {
      if (
        error instanceof Error &&
        "name" in error &&
        error.name === "SequelizeUniqueConstraintError"
      ) {
        throw new AppError(409, "PRODUCT_ALREADY_IN_STORE", "This product is already in the store")
      }
      throw error
    }
  }),
)

router.patch(
  "/:id/products/:productId",
  asyncHandler(async (req, res) => {
    const storeId = req.params.id as string
    const store = await Store.findByPk(storeId)
    if (!store || store.operator_id !== getOperator(req).id) {
      throw new AppError(404, "STORE_NOT_FOUND", "Store not found")
    }

    const storeProduct = await StoreProduct.findOne({
      where: { store_id: store.id, product_id: req.params.productId },
    })
    if (!storeProduct) {
      throw new AppError(404, "STORE_PRODUCT_NOT_FOUND", "Product not found in this store")
    }

    const { quantity_on_hand, low_stock_threshold } = req.body
    if (quantity_on_hand === undefined && low_stock_threshold === undefined) {
      throw new AppError(400, "VALIDATION_ERROR", "Provide quantity_on_hand or low_stock_threshold")
    }

    if (quantity_on_hand !== undefined) {
      const delta = quantity_on_hand - storeProduct.quantity_on_hand
      if (delta !== 0) {
        const eventType = delta > 0 ? "restock" : "adjustment"
        await adjustInventory({
          storeProductId: storeProduct.id,
          eventType,
          quantity: Math.abs(delta),
        })
      }
    }

    if (low_stock_threshold !== undefined) {
      storeProduct.low_stock_threshold = low_stock_threshold
      await storeProduct.save()
    }

    // Re-read to get fresh version and quantity_on_hand
    const updated = await StoreProduct.findByPk(storeProduct.id)
    res.json(envelope(updated, buildMeta(req)))
  }),
)

router.get(
  "/:id/products/:productId/events",
  asyncHandler(async (req, res) => {
    const store = await Store.findByPk(req.params.id as string)
    if (!store || store.operator_id !== getOperator(req).id) {
      throw new AppError(404, "STORE_NOT_FOUND", "Store not found")
    }

    const storeProduct = await StoreProduct.findOne({
      where: { store_id: store.id, product_id: req.params.productId },
    })
    if (!storeProduct) {
      throw new AppError(404, "STORE_PRODUCT_NOT_FOUND", "Product not found in this store")
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const offset = Number(req.query.offset) || 0
    const { events, total } = await getEventHistory(storeProduct.id, { limit, offset })

    res.json(envelope({ events, total }, buildMeta(req)))
  }),
)

export { router as storesRouter }

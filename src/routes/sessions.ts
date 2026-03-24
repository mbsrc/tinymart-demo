import { Router } from "express"
import {
  Product,
  Session,
  SessionItem,
  Store,
  StoreProduct,
  Transaction,
  sequelize,
} from "../models/index.js"
import { chargeOrDefer } from "../services/deferredCharge.js"
import { adjustInventory } from "../services/inventory.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"
import { reconcileCart } from "../utils/reconcileCart.js"

const router = Router()

// POST /api/sessions — open a new shopping session
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { store_id, stripe_payment_method_id } = req.body

    if (!store_id || typeof store_id !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "store_id is required")
    }

    const store = await Store.findByPk(store_id)
    if (!store) {
      throw new AppError(404, "STORE_NOT_FOUND", "Store not found")
    }

    if (store.status !== "online") {
      throw new AppError(422, "STORE_NOT_ONLINE", "Store is not currently accepting sessions")
    }

    const session = await Session.create({
      store_id,
      stripe_customer_id: stripe_payment_method_id ?? null,
    })

    res.status(201).json(envelope(session, buildMeta(req)))
  }),
)

// GET /api/sessions/:id — get session with items and transaction
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id as string
    const session = await Session.findByPk(sessionId, {
      include: [{ model: SessionItem, include: [Product] }, { model: Transaction }],
    })

    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found")
    }

    res.json(envelope(session, buildMeta(req)))
  }),
)

// POST /api/sessions/:id/items — add or remove an item
router.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id as string
    const session = await Session.findByPk(sessionId)
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found")
    }

    if (session.status !== "open") {
      throw new AppError(409, "SESSION_NOT_OPEN", "Session is not open")
    }

    const { product_id, action } = req.body

    if (!product_id || typeof product_id !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "product_id is required")
    }

    if (action !== "added" && action !== "removed") {
      throw new AppError(400, "VALIDATION_ERROR", "action must be 'added' or 'removed'")
    }

    // Product must exist and belong to the session's store
    const storeProduct = await StoreProduct.findOne({
      where: { store_id: session.store_id, product_id },
    })

    if (!storeProduct) {
      throw new AppError(404, "PRODUCT_NOT_IN_STORE", "Product not found in this store")
    }

    const item = await SessionItem.create({
      session_id: session.id,
      product_id,
      action,
    })

    res.status(201).json(envelope(item, buildMeta(req)))
  }),
)

// POST /api/sessions/:id/close — reconcile cart, charge, deduct inventory
router.post(
  "/:id/close",
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id as string
    const session = await Session.findByPk(sessionId, {
      include: [{ model: SessionItem }],
    })

    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found")
    }

    if (session.status !== "open") {
      throw new AppError(409, "SESSION_NOT_OPEN", "Session is already closed")
    }

    const items = session.SessionItems ?? []
    const cart = reconcileCart(items)

    // Empty cart — close without charging
    if (cart.length === 0) {
      session.status = "closed"
      session.closed_at = new Date()
      await session.save()

      res.json(envelope(session, buildMeta(req)))
      return
    }

    // Look up prices and store_product IDs for each cart line
    const cartDetails = await Promise.all(
      cart.map(async (line) => {
        const storeProduct = await StoreProduct.findOne({
          where: { store_id: session.store_id, product_id: line.product_id },
          include: [Product],
        })

        if (!storeProduct || !storeProduct.Product) {
          throw new AppError(
            404,
            "PRODUCT_NOT_IN_STORE",
            `Product ${line.product_id} not found in store`,
          )
        }

        if (storeProduct.quantity_on_hand < line.quantity) {
          throw new AppError(
            409,
            "INSUFFICIENT_STOCK",
            `Not enough stock for ${storeProduct.Product.name}`,
          )
        }

        return {
          storeProductId: storeProduct.id,
          productId: line.product_id,
          quantity: line.quantity,
          priceCents: storeProduct.Product.price_cents,
        }
      }),
    )

    const totalCents = cartDetails.reduce((sum, d) => sum + d.priceCents * d.quantity, 0)

    // All-or-nothing: deduct inventory, charge, create transaction
    await sequelize.transaction(async (t) => {
      // Deduct inventory for each item
      for (const detail of cartDetails) {
        await adjustInventory({
          storeProductId: detail.storeProductId,
          eventType: "deduct",
          quantity: detail.quantity,
          referenceId: session.id,
          referenceType: "session",
        })
      }

      // Charge or defer
      const chargeResult = await chargeOrDefer(session.id, {
        amount: totalCents,
        currency: "usd",
        metadata: { session_id: session.id },
      })

      const sessionStatus = chargeResult.outcome === "charged" ? "charged" : "failed"
      const chargedAt = chargeResult.outcome === "charged" ? new Date() : null
      const stripeChargeId = chargeResult.paymentIntent?.id ?? null

      // Create transaction record
      await Transaction.create(
        {
          session_id: session.id,
          store_id: session.store_id,
          total_cents: totalCents,
          stripe_charge_id: stripeChargeId,
          status: chargeResult.outcome === "charged" ? "succeeded" : "pending",
        },
        { transaction: t },
      )

      // Update session
      await session.update(
        {
          status: sessionStatus,
          closed_at: new Date(),
          charged_at: chargedAt,
          stripe_payment_intent_id: stripeChargeId,
        },
        { transaction: t },
      )
    })

    // Re-fetch session with associations for the response
    const updatedSession = await Session.findByPk(session.id, {
      include: [{ model: Transaction }],
    })

    res.json(envelope(updatedSession, buildMeta(req)))
  }),
)

export { router as sessionsRouter }

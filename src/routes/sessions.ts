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
import { cancelPreAuth, capturePayment, createPreAuth } from "../services/stripe.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"
import { reconcileCart } from "../utils/reconcileCart.js"

const router = Router()

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
      throw new AppError(422, "STORE_UNAVAILABLE", "Store is not currently accepting sessions")
    }

    let paymentIntentId: string | null = null
    let customerId: string | null = null

    if (stripe_payment_method_id) {
      const preAuth = await createPreAuth(stripe_payment_method_id)
      paymentIntentId = preAuth.paymentIntentId
      customerId = preAuth.customerId
    }

    const session = await Session.create({
      store_id,
      stripe_customer_id: customerId,
      stripe_payment_intent_id: paymentIntentId,
      idempotency_key: null,
    })

    res.status(201).json(
      envelope(
        {
          id: session.id,
          status: session.status,
          store_id: session.store_id,
          opened_at: session.opened_at,
        },
        buildMeta(req),
      ),
    )
  }),
)

router.post(
  "/:id/items",
  asyncHandler(async (req, res) => {
    const sessionId = req.params.id as string
    const { product_id, action } = req.body

    if (!product_id || typeof product_id !== "string") {
      throw new AppError(400, "VALIDATION_ERROR", "product_id is required")
    }
    if (action !== "added" && action !== "removed") {
      throw new AppError(400, "VALIDATION_ERROR", "action must be 'added' or 'removed'")
    }

    const session = await Session.findByPk(sessionId)
    if (!session) {
      throw new AppError(404, "SESSION_NOT_FOUND", "Session not found")
    }
    if (session.status !== "open") {
      throw new AppError(422, "SESSION_NOT_OPEN", "Session is not open")
    }

    const storeProduct = await StoreProduct.findOne({
      where: { store_id: session.store_id, product_id },
    })
    if (!storeProduct) {
      throw new AppError(404, "PRODUCT_NOT_IN_STORE", "Product is not available in this store")
    }

    const item = await SessionItem.create({
      session_id: sessionId,
      product_id,
      action,
    })

    res.status(201).json(envelope(item, buildMeta(req)))
  }),
)

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
      throw new AppError(422, "SESSION_NOT_OPEN", "Session is not open")
    }

    const cartItems = reconcileCart(session.SessionItems ?? [])

    if (cartItems.length === 0) {
      if (session.stripe_payment_intent_id) {
        await cancelPreAuth(session.stripe_payment_intent_id)
      }
      await session.update({ status: "closed", closed_at: new Date() })
      res.json(
        envelope({ id: session.id, status: "closed", total_cents: 0, items: [] }, buildMeta(req)),
      )
      return
    }

    const productIds = cartItems.map((ci) => ci.product_id)
    const products = await Product.findAll({ where: { id: productIds } })
    const productMap = new Map(products.map((p) => [p.id, p]))

    let totalCents = 0
    const itemDetails = cartItems.map((ci) => {
      const product = productMap.get(ci.product_id)
      if (!product) {
        throw new AppError(500, "INTERNAL_ERROR", `Product ${ci.product_id} not found`)
      }
      const subtotal = product.price_cents * ci.quantity
      totalCents += subtotal
      return {
        product_id: ci.product_id,
        name: product.name,
        sku: product.sku,
        price_cents: product.price_cents,
        quantity: ci.quantity,
        subtotal_cents: subtotal,
      }
    })

    let chargeId: string | null = null
    let chargeStatus: "succeeded" | "failed" = "succeeded"

    if (session.stripe_payment_intent_id) {
      try {
        const captureResult = await capturePayment(session.stripe_payment_intent_id, totalCents)
        chargeId = captureResult.chargeId
        chargeStatus = captureResult.status
      } catch (error) {
        chargeStatus = "failed"
        const now = new Date()
        await Transaction.create({
          session_id: sessionId,
          store_id: session.store_id,
          total_cents: totalCents,
          stripe_charge_id: null,
          idempotency_key: null,
          status: "failed",
        })
        await session.update({ status: "failed", closed_at: now })
        throw error
      }
    }

    const now = new Date()
    const txn = await sequelize.transaction(async (t) => {
      for (const ci of cartItems) {
        await StoreProduct.decrement("quantity_on_hand", {
          by: ci.quantity,
          where: { store_id: session.store_id, product_id: ci.product_id },
          transaction: t,
        })
      }

      const transaction = await Transaction.create(
        {
          session_id: sessionId,
          store_id: session.store_id,
          total_cents: totalCents,
          stripe_charge_id: chargeId,
          idempotency_key: null,
          status: chargeStatus,
        },
        { transaction: t },
      )

      await session.update(
        { status: "charged", closed_at: now, charged_at: now },
        { transaction: t },
      )

      return transaction
    })

    res.json(
      envelope(
        {
          id: session.id,
          status: "charged",
          transaction_id: txn.id,
          total_cents: totalCents,
          items: itemDetails,
        },
        buildMeta(req),
      ),
    )
  }),
)

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

export { router as sessionsRouter }

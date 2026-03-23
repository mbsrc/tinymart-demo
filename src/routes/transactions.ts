import { Router } from "express"
import { Op } from "sequelize"
import { getOperator } from "../middleware/auth.js"
import { Product, Session, SessionItem, Store, Transaction } from "../models/index.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"
import { paginationMeta, parsePagination } from "../utils/pagination.js"
import { reconcileCart } from "../utils/reconcileCart.js"

const router = Router()

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const operator = getOperator(req)
    const { page, limit, offset } = parsePagination(req.query as Record<string, unknown>)

    const where: Record<string, unknown> = {}
    const storeWhere: Record<string, unknown> = { operator_id: operator.id }

    if (req.query.store_id && typeof req.query.store_id === "string") {
      where.store_id = req.query.store_id
    }

    if (req.query.status && typeof req.query.status === "string") {
      where.status = req.query.status
    }

    if (req.query.start_date && typeof req.query.start_date === "string") {
      const gte = new Date(`${req.query.start_date}T00:00:00.000Z`)
      where.created_at = { ...((where.created_at as object) ?? {}), [Op.gte]: gte }
    }
    if (req.query.end_date && typeof req.query.end_date === "string") {
      const lte = new Date(`${req.query.end_date}T23:59:59.999Z`)
      where.created_at = { ...((where.created_at as object) ?? {}), [Op.lte]: lte }
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        {
          model: Store,
          where: storeWhere,
          attributes: ["id", "name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    })

    const meta = buildMeta(req)
    meta.pagination = paginationMeta(page, limit, count)

    res.json(envelope(rows, meta))
  }),
)

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const operator = getOperator(req)
    const transactionId = req.params.id as string

    const transaction = await Transaction.findByPk(transactionId, {
      include: [
        {
          model: Store,
          where: { operator_id: operator.id },
          attributes: ["id", "name"],
        },
        {
          model: Session,
          attributes: ["id", "status", "opened_at", "closed_at", "charged_at"],
          include: [
            {
              model: SessionItem,
              include: [
                {
                  model: Product,
                  attributes: ["id", "name", "sku", "price_cents"],
                },
              ],
            },
          ],
        },
      ],
    })

    if (!transaction) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found")
    }

    const sessionItems = transaction.Session?.SessionItems ?? []
    const reconciledItems = reconcileCart(sessionItems)

    const productMap = new Map(
      sessionItems
        .filter((si) => si.Product)
        .map((si) => {
          const p = si.Product as Product
          return [p.id, p]
        }),
    )

    const items = reconciledItems.map((ci) => {
      const product = productMap.get(ci.product_id)
      return {
        product_id: ci.product_id,
        name: product?.name ?? null,
        sku: product?.sku ?? null,
        price_cents: product?.price_cents ?? 0,
        quantity: ci.quantity,
        subtotal_cents: (product?.price_cents ?? 0) * ci.quantity,
      }
    })

    res.json(
      envelope(
        {
          id: transaction.id,
          session_id: transaction.session_id,
          store_id: transaction.store_id,
          store_name: transaction.Store?.name ?? null,
          total_cents: transaction.total_cents,
          status: transaction.status,
          stripe_charge_id: transaction.stripe_charge_id,
          created_at: transaction.created_at,
          session: transaction.Session
            ? {
                id: transaction.Session.id,
                status: transaction.Session.status,
                opened_at: transaction.Session.opened_at,
                closed_at: transaction.Session.closed_at,
                charged_at: transaction.Session.charged_at,
              }
            : null,
          items,
        },
        buildMeta(req),
      ),
    )
  }),
)

export { router as transactionsRouter }

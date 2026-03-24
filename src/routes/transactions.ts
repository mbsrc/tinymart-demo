import { Router } from "express"
import { Op, type WhereOptions } from "sequelize"
import { getOperator } from "../middleware/auth.js"
import { Product, Session, SessionItem, Store, Transaction } from "../models/index.js"
import { AppError } from "../types/index.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { buildMeta, envelope } from "../utils/envelope.js"

const router = Router()

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const operatorId = getOperator(req).id
    const { store_id, status, from, to } = req.query
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const offset = Number(req.query.offset) || 0

    const where: WhereOptions = {}

    // Scope to operator's stores
    const operatorStoreIds = (
      await Store.findAll({
        where: { operator_id: operatorId },
        attributes: ["id"],
      })
    ).map((s) => s.id)

    where.store_id =
      store_id && typeof store_id === "string"
        ? operatorStoreIds.includes(store_id)
          ? store_id
          : "none"
        : { [Op.in]: operatorStoreIds }

    if (status && typeof status === "string") {
      where.status = status
    }

    if (from || to) {
      const dateRange: Record<symbol, Date> = {}
      if (from && typeof from === "string") dateRange[Op.gte] = new Date(from)
      if (to && typeof to === "string") dateRange[Op.lte] = new Date(to)
      where.created_at = dateRange
    }

    const { rows, count } = await Transaction.findAndCountAll({
      where,
      include: [{ model: Store, attributes: ["id", "name"] }],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    })

    res.json(envelope({ transactions: rows, total: count, limit, offset }, buildMeta(req)))
  }),
)

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const operatorId = getOperator(req).id
    const txn = await Transaction.findByPk(req.params.id as string, {
      include: [
        { model: Store, attributes: ["id", "name", "location_name"] },
        {
          model: Session,
          include: [
            {
              model: SessionItem,
              include: [
                { model: Product, attributes: ["id", "name", "price_cents", "sku", "category"] },
              ],
            },
          ],
        },
      ],
    })

    if (!txn) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found")
    }

    // Verify operator owns the store
    const store = await Store.findByPk(txn.store_id, { attributes: ["operator_id"] })
    if (!store || store.operator_id !== operatorId) {
      throw new AppError(404, "TRANSACTION_NOT_FOUND", "Transaction not found")
    }

    res.json(envelope(txn, buildMeta(req)))
  }),
)

export { router as transactionsRouter }

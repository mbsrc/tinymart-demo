import { DataTypes, Model, type Sequelize } from "sequelize"
import type { Session } from "./Session.js"
import type { Store } from "./Store.js"

type TransactionStatus = "pending" | "succeeded" | "failed" | "refunded"

interface TransactionAttributes {
  id: string
  session_id: string
  store_id: string
  total_cents: number
  stripe_charge_id: string | null
  idempotency_key: string | null
  status: TransactionStatus
  created_at?: Date
  updated_at?: Date
}

type TransactionCreationAttributes = Omit<
  TransactionAttributes,
  "id" | "status" | "created_at" | "updated_at"
> & {
  status?: TransactionStatus
}

class Transaction extends Model<TransactionAttributes, TransactionCreationAttributes> {
  declare id: string
  declare session_id: string
  declare store_id: string
  declare total_cents: number
  declare stripe_charge_id: string | null
  declare idempotency_key: string | null
  declare status: TransactionStatus
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Session?: Session
  declare Store?: Store

  static associate(models: Record<string, unknown>) {
    const { Session, Store } = models as {
      Session: typeof import("./Session.js").Session
      Store: typeof import("./Store.js").Store
    }
    Transaction.belongsTo(Session, { foreignKey: "session_id" })
    Transaction.belongsTo(Store, { foreignKey: "store_id" })
  }

  static initialize(sequelize: Sequelize) {
    Transaction.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        session_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        store_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        total_cents: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        stripe_charge_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        idempotency_key: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM("pending", "succeeded", "failed", "refunded"),
          allowNull: false,
          defaultValue: "pending",
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "transactions",
        underscored: true,
      },
    )
  }
}

export { Transaction }
export type { TransactionAttributes, TransactionCreationAttributes, TransactionStatus }

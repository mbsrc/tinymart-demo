import { DataTypes, Model, type Sequelize } from "sequelize"
import type { SessionItem } from "./SessionItem.js"
import type { Store } from "./Store.js"
import type { Transaction } from "./Transaction.js"

type SessionStatus = "open" | "closed" | "charged" | "failed"

interface SessionAttributes {
  id: string
  store_id: string
  stripe_payment_method_id: string | null
  stripe_payment_intent_id: string | null
  idempotency_key: string | null
  status: SessionStatus
  opened_at: Date
  closed_at: Date | null
  charged_at: Date | null
  created_at?: Date
  updated_at?: Date
}

type SessionCreationAttributes = Omit<
  SessionAttributes,
  "id" | "status" | "opened_at" | "closed_at" | "charged_at" | "created_at" | "updated_at"
> & {
  status?: SessionStatus
  opened_at?: Date
  closed_at?: Date | null
  charged_at?: Date | null
}

class Session extends Model<SessionAttributes, SessionCreationAttributes> {
  declare id: string
  declare store_id: string
  declare stripe_payment_method_id: string | null
  declare stripe_payment_intent_id: string | null
  declare idempotency_key: string | null
  declare status: SessionStatus
  declare opened_at: Date
  declare closed_at: Date | null
  declare charged_at: Date | null
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Store?: Store
  declare SessionItems?: SessionItem[]
  declare Transaction?: Transaction

  static associate(models: Record<string, unknown>) {
    const { Store, SessionItem, Transaction } = models as {
      Store: typeof import("./Store.js").Store
      SessionItem: typeof import("./SessionItem.js").SessionItem
      Transaction: typeof import("./Transaction.js").Transaction
    }
    Session.belongsTo(Store, { foreignKey: "store_id" })
    Session.hasMany(SessionItem, { foreignKey: "session_id" })
    Session.hasOne(Transaction, { foreignKey: "session_id" })
  }

  static initialize(sequelize: Sequelize) {
    Session.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        store_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        stripe_payment_method_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        stripe_payment_intent_id: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        idempotency_key: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM("open", "closed", "charged", "failed"),
          allowNull: false,
          defaultValue: "open",
        },
        opened_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        closed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        charged_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "sessions",
        underscored: true,
      },
    )
  }
}

export { Session }
export type { SessionAttributes, SessionCreationAttributes, SessionStatus }

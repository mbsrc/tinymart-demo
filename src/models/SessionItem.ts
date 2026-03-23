import { DataTypes, Model, type Sequelize } from "sequelize"
import type { Product } from "./Product.js"
import type { Session } from "./Session.js"

type SessionItemAction = "added" | "removed"

interface SessionItemAttributes {
  id: string
  session_id: string
  product_id: string
  action: SessionItemAction
  timestamp: Date
  created_at?: Date
  updated_at?: Date
}

type SessionItemCreationAttributes = Omit<
  SessionItemAttributes,
  "id" | "timestamp" | "created_at" | "updated_at"
> & {
  timestamp?: Date
}

class SessionItem extends Model<SessionItemAttributes, SessionItemCreationAttributes> {
  declare id: string
  declare session_id: string
  declare product_id: string
  declare action: SessionItemAction
  declare timestamp: Date
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Session?: Session
  declare Product?: Product

  static associate(models: Record<string, unknown>) {
    const { Session, Product } = models as {
      Session: typeof import("./Session.js").Session
      Product: typeof import("./Product.js").Product
    }
    SessionItem.belongsTo(Session, { foreignKey: "session_id" })
    SessionItem.belongsTo(Product, { foreignKey: "product_id" })
  }

  static initialize(sequelize: Sequelize) {
    SessionItem.init(
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
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        action: {
          type: DataTypes.ENUM("added", "removed"),
          allowNull: false,
        },
        timestamp: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "session_items",
        underscored: true,
      },
    )
  }
}

export { SessionItem }
export type { SessionItemAttributes, SessionItemCreationAttributes, SessionItemAction }

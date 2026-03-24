import { DataTypes, Model, type Sequelize } from "sequelize"
import type { StoreProduct } from "./StoreProduct.js"

type InventoryEventType = "restock" | "reserve" | "release" | "deduct" | "adjustment"

interface InventoryEventAttributes {
  id: string
  store_product_id: string
  event_type: InventoryEventType
  quantity: number
  version: number
  reference_id: string | null
  reference_type: string | null
  metadata: Record<string, unknown> | null
  created_at?: Date
}

type InventoryEventCreationAttributes = Omit<InventoryEventAttributes, "id" | "created_at">

class InventoryEvent extends Model<InventoryEventAttributes, InventoryEventCreationAttributes> {
  declare id: string
  declare store_product_id: string
  declare event_type: InventoryEventType
  declare quantity: number
  declare version: number
  declare reference_id: string | null
  declare reference_type: string | null
  declare metadata: Record<string, unknown> | null
  declare readonly created_at: Date

  declare StoreProduct?: StoreProduct

  static associate(models: Record<string, unknown>) {
    const { StoreProduct } = models as {
      StoreProduct: typeof import("./StoreProduct.js").StoreProduct
    }
    InventoryEvent.belongsTo(StoreProduct, { foreignKey: "store_product_id" })
  }

  static initialize(sequelize: Sequelize) {
    InventoryEvent.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        store_product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        event_type: {
          type: DataTypes.ENUM("restock", "reserve", "release", "deduct", "adjustment"),
          allowNull: false,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        reference_id: {
          type: DataTypes.UUID,
          allowNull: true,
        },
        reference_type: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        metadata: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        created_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "inventory_events",
        underscored: true,
        timestamps: true,
        updatedAt: false,
        indexes: [
          {
            unique: true,
            fields: ["store_product_id", "version"],
          },
          {
            fields: ["reference_id", "reference_type"],
          },
        ],
      },
    )
  }
}

export { InventoryEvent }
export type { InventoryEventAttributes, InventoryEventCreationAttributes, InventoryEventType }

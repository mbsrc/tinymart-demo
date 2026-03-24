import { DataTypes, Model, type Sequelize } from "sequelize"
import type { InventoryEvent } from "./InventoryEvent.js"
import type { Product } from "./Product.js"
import type { Store } from "./Store.js"

interface StoreProductAttributes {
  id: string
  store_id: string
  product_id: string
  quantity_on_hand: number
  low_stock_threshold: number
  version: number
  created_at?: Date
  updated_at?: Date
}

type StoreProductCreationAttributes = Omit<
  StoreProductAttributes,
  "id" | "quantity_on_hand" | "low_stock_threshold" | "version" | "created_at" | "updated_at"
> & {
  quantity_on_hand?: number
  low_stock_threshold?: number
}

class StoreProduct extends Model<StoreProductAttributes, StoreProductCreationAttributes> {
  declare id: string
  declare store_id: string
  declare product_id: string
  declare quantity_on_hand: number
  declare low_stock_threshold: number
  declare version: number
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Store?: Store
  declare Product?: Product
  declare InventoryEvents?: InventoryEvent[]

  static associate(models: Record<string, unknown>) {
    const { Store, Product, InventoryEvent } = models as {
      Store: typeof import("./Store.js").Store
      Product: typeof import("./Product.js").Product
      InventoryEvent: typeof import("./InventoryEvent.js").InventoryEvent
    }
    StoreProduct.belongsTo(Store, { foreignKey: "store_id" })
    StoreProduct.belongsTo(Product, { foreignKey: "product_id" })
    StoreProduct.hasMany(InventoryEvent, { foreignKey: "store_product_id" })
  }

  static initialize(sequelize: Sequelize) {
    StoreProduct.init(
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
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        quantity_on_hand: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        low_stock_threshold: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 5,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "store_products",
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ["store_id", "product_id"],
          },
        ],
      },
    )
  }
}

export { StoreProduct }
export type { StoreProductAttributes, StoreProductCreationAttributes }

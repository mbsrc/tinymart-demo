import { DataTypes, Model, type Sequelize } from "sequelize"
import type { Product } from "./Product.js"
import type { Store } from "./Store.js"

interface OperatorAttributes {
  id: string
  name: string
  email: string
  api_key: string
  created_at?: Date
  updated_at?: Date
}

type OperatorCreationAttributes = Omit<OperatorAttributes, "id" | "created_at" | "updated_at">

class Operator extends Model<OperatorAttributes, OperatorCreationAttributes> {
  declare id: string
  declare name: string
  declare email: string
  declare api_key: string
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Stores?: Store[]
  declare Products?: Product[]

  static associate(models: Record<string, unknown>) {
    const { Store, Product } = models as {
      Store: typeof import("./Store.js").Store
      Product: typeof import("./Product.js").Product
    }
    Operator.hasMany(Store, { foreignKey: "operator_id" })
    Operator.hasMany(Product, { foreignKey: "operator_id" })
  }

  static initialize(sequelize: Sequelize) {
    Operator.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        api_key: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "operators",
        underscored: true,
      },
    )
  }
}

export { Operator }
export type { OperatorAttributes, OperatorCreationAttributes }

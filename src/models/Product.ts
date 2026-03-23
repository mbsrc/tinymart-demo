import { DataTypes, Model, type Sequelize } from "sequelize"
import type { Operator } from "./Operator.js"
import type { StoreProduct } from "./StoreProduct.js"

type ProductCategory = "pantry" | "fridge" | "freezer"

interface ProductAttributes {
  id: string
  operator_id: string
  name: string
  sku: string
  price_cents: number
  image_url: string | null
  category: ProductCategory
  created_at?: Date
  updated_at?: Date
}

type ProductCreationAttributes = Omit<ProductAttributes, "id" | "created_at" | "updated_at">

class Product extends Model<ProductAttributes, ProductCreationAttributes> {
  declare id: string
  declare operator_id: string
  declare name: string
  declare sku: string
  declare price_cents: number
  declare image_url: string | null
  declare category: ProductCategory
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Operator?: Operator
  declare StoreProducts?: StoreProduct[]

  static associate(models: Record<string, unknown>) {
    const { Operator, StoreProduct } = models as {
      Operator: typeof import("./Operator.js").Operator
      StoreProduct: typeof import("./StoreProduct.js").StoreProduct
    }
    Product.belongsTo(Operator, { foreignKey: "operator_id" })
    Product.hasMany(StoreProduct, { foreignKey: "product_id" })
  }

  static initialize(sequelize: Sequelize) {
    Product.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        operator_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        sku: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        price_cents: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        image_url: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        category: {
          type: DataTypes.ENUM("pantry", "fridge", "freezer"),
          allowNull: false,
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "products",
        underscored: true,
      },
    )
  }
}

export { Product }
export type { ProductAttributes, ProductCreationAttributes, ProductCategory }

import { DataTypes, Model, type Sequelize } from "sequelize"
import type { Operator } from "./Operator.js"
import type { Session } from "./Session.js"
import type { StoreProduct } from "./StoreProduct.js"

type StoreStatus = "online" | "offline" | "maintenance"

interface StoreAttributes {
  id: string
  operator_id: string
  name: string
  location_name: string | null
  address: string | null
  status: StoreStatus
  created_at?: Date
  updated_at?: Date
}

type StoreCreationAttributes = Omit<
  StoreAttributes,
  "id" | "status" | "created_at" | "updated_at"
> & {
  status?: StoreStatus
}

class Store extends Model<StoreAttributes, StoreCreationAttributes> {
  declare id: string
  declare operator_id: string
  declare name: string
  declare location_name: string | null
  declare address: string | null
  declare status: StoreStatus
  declare readonly created_at: Date
  declare readonly updated_at: Date

  declare Operator?: Operator
  declare StoreProducts?: StoreProduct[]
  declare Sessions?: Session[]

  static associate(models: Record<string, unknown>) {
    const { Operator, StoreProduct, Session } = models as {
      Operator: typeof import("./Operator.js").Operator
      StoreProduct: typeof import("./StoreProduct.js").StoreProduct
      Session: typeof import("./Session.js").Session
    }
    Store.belongsTo(Operator, { foreignKey: "operator_id" })
    Store.hasMany(StoreProduct, { foreignKey: "store_id" })
    Store.hasMany(Session, { foreignKey: "store_id" })
  }

  static initialize(sequelize: Sequelize) {
    Store.init(
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
        location_name: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        address: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("online", "offline", "maintenance"),
          allowNull: false,
          defaultValue: "offline",
        },
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "stores",
        underscored: true,
      },
    )
  }
}

export { Store }
export type { StoreAttributes, StoreCreationAttributes, StoreStatus }

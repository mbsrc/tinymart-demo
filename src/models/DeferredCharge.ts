import { DataTypes, Model, type Sequelize } from "sequelize"

export type DeferredChargeStatus = "pending" | "succeeded" | "failed"

interface DeferredChargeAttributes {
  id: string
  session_id: string
  amount: number
  currency: string
  stripe_params: Record<string, unknown>
  status: DeferredChargeStatus
  attempts: number
  last_error: string | null
  created_at?: Date
  processed_at: Date | null
}

type DeferredChargeCreationAttributes = Omit<
  DeferredChargeAttributes,
  "id" | "created_at" | "status" | "attempts" | "last_error" | "processed_at"
>

class DeferredCharge extends Model<DeferredChargeAttributes, DeferredChargeCreationAttributes> {
  declare id: string
  declare session_id: string
  declare amount: number
  declare currency: string
  declare stripe_params: Record<string, unknown>
  declare status: DeferredChargeStatus
  declare attempts: number
  declare last_error: string | null
  declare readonly created_at: Date
  declare processed_at: Date | null

  static associate(_models: Record<string, unknown>) {
    // Standalone table — no associations
  }

  static initialize(sequelize: Sequelize) {
    DeferredCharge.init(
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
        amount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        currency: {
          type: DataTypes.STRING(3),
          allowNull: false,
          defaultValue: "usd",
        },
        stripe_params: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: "pending",
        },
        attempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        last_error: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        created_at: DataTypes.DATE,
        processed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "deferred_charges",
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    )
  }
}

export { DeferredCharge }
export type { DeferredChargeAttributes, DeferredChargeCreationAttributes }

import { DataTypes, Model, type Sequelize } from "sequelize"

interface IdempotencyKeyAttributes {
  key: string
  request_path: string
  request_body_hash: string
  response_status: number | null
  response_body: Record<string, unknown> | null
  created_at: Date
  expires_at: Date
}

type IdempotencyKeyCreationAttributes = Omit<IdempotencyKeyAttributes, "created_at">

class IdempotencyKey extends Model<IdempotencyKeyAttributes, IdempotencyKeyCreationAttributes> {
  declare key: string
  declare request_path: string
  declare request_body_hash: string
  declare response_status: number | null
  declare response_body: Record<string, unknown> | null
  declare readonly created_at: Date
  declare expires_at: Date

  static associate(_models: Record<string, unknown>) {
    // Standalone table — no associations
  }

  static initialize(sequelize: Sequelize) {
    IdempotencyKey.init(
      {
        key: {
          type: DataTypes.STRING(255),
          primaryKey: true,
          allowNull: false,
        },
        request_path: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        request_body_hash: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        response_status: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        response_body: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
        created_at: DataTypes.DATE,
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "idempotency_keys",
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    )
  }
}

export { IdempotencyKey }
export type { IdempotencyKeyAttributes, IdempotencyKeyCreationAttributes }

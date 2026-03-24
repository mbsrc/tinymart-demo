import { DataTypes, Model, type Sequelize } from "sequelize"

interface PendingJobAttributes {
  id: string
  queue_name: string
  payload: Record<string, unknown>
  created_at?: Date
  processed_at: Date | null
}

type PendingJobCreationAttributes = Omit<PendingJobAttributes, "id" | "created_at">

class PendingJob extends Model<PendingJobAttributes, PendingJobCreationAttributes> {
  declare id: string
  declare queue_name: string
  declare payload: Record<string, unknown>
  declare readonly created_at: Date
  declare processed_at: Date | null

  static associate(_models: Record<string, unknown>) {
    // Standalone table — no associations
  }

  static initialize(sequelize: Sequelize) {
    PendingJob.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        queue_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        payload: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        created_at: DataTypes.DATE,
        processed_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: "pending_jobs",
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    )
  }
}

export { PendingJob }
export type { PendingJobAttributes, PendingJobCreationAttributes }

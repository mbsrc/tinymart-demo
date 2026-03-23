import { DataTypes, Model, type Sequelize } from "sequelize"

interface JobFailureAttributes {
  id: string
  job_name: string
  payload: Record<string, unknown>
  error_message: string
  attempts: number
  last_attempted_at: Date
  created_at?: Date
}

type JobFailureCreationAttributes = Omit<JobFailureAttributes, "id" | "created_at">

class JobFailure extends Model<JobFailureAttributes, JobFailureCreationAttributes> {
  declare id: string
  declare job_name: string
  declare payload: Record<string, unknown>
  declare error_message: string
  declare attempts: number
  declare last_attempted_at: Date
  declare readonly created_at: Date

  static associate(_models: Record<string, unknown>) {
    // Standalone table — no associations
  }

  static initialize(sequelize: Sequelize) {
    JobFailure.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        job_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        payload: {
          type: DataTypes.JSONB,
          allowNull: false,
        },
        error_message: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        attempts: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        last_attempted_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        created_at: DataTypes.DATE,
      },
      {
        sequelize,
        tableName: "job_failures",
        underscored: true,
        timestamps: true,
        updatedAt: false,
      },
    )
  }
}

export { JobFailure }
export type { JobFailureAttributes, JobFailureCreationAttributes }

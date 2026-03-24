import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "pending_jobs",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
          },
          queue_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
          },
          payload: {
            type: DataTypes.JSONB,
            allowNull: false,
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          processed_at: {
            type: DataTypes.DATE,
            allowNull: true,
          },
        },
        { transaction },
      )

      await queryInterface.addIndex("pending_jobs", ["queue_name", "processed_at"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("pending_jobs", { transaction })
    })
  },
}

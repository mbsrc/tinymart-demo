import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "job_failures",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
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
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        { transaction },
      )

      await queryInterface.addIndex("job_failures", ["job_name"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("job_failures", { transaction })
    })
  },
}

import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "deferred_charges",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
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

      await queryInterface.addIndex("deferred_charges", ["status"], { transaction })
      await queryInterface.addIndex("deferred_charges", ["session_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("deferred_charges", { transaction })
    })
  },
}

import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "idempotency_keys",
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
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        { transaction },
      )

      await queryInterface.addIndex("idempotency_keys", ["expires_at"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("idempotency_keys", { transaction })
    })
  },
}

import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "transactions",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          session_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "sessions", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          store_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "stores", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          total_cents: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          stripe_charge_id: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          idempotency_key: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
          },
          status: {
            type: DataTypes.ENUM("pending", "succeeded", "failed", "refunded"),
            allowNull: false,
            defaultValue: "pending",
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        { transaction },
      )

      await queryInterface.addIndex("transactions", ["session_id"], { transaction })
      await queryInterface.addIndex("transactions", ["store_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("transactions", { transaction })
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_transactions_status"', {
        transaction,
      })
    })
  },
}

import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "sessions",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          store_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "stores", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          stripe_customer_id: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          stripe_payment_intent_id: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          idempotency_key: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
          },
          status: {
            type: DataTypes.ENUM("open", "closed", "charged", "failed"),
            allowNull: false,
            defaultValue: "open",
          },
          opened_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
          },
          closed_at: {
            type: DataTypes.DATE,
            allowNull: true,
          },
          charged_at: {
            type: DataTypes.DATE,
            allowNull: true,
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

      await queryInterface.addIndex("sessions", ["store_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("sessions", { transaction })
    })
  },
}

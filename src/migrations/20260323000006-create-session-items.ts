import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "session_items",
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
          product_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "products", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          action: {
            type: DataTypes.ENUM("added", "removed"),
            allowNull: false,
          },
          timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
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

      await queryInterface.addIndex("session_items", ["session_id"], { transaction })
      await queryInterface.addIndex("session_items", ["product_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("session_items", { transaction })
    })
  },
}

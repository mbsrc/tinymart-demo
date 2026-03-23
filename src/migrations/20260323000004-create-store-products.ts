import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "store_products",
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
          product_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "products", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          quantity_on_hand: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          low_stock_threshold: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
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

      await queryInterface.addIndex("store_products", ["store_id", "product_id"], {
        unique: true,
        transaction,
      })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("store_products", { transaction })
    })
  },
}

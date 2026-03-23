import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "products",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
          },
          operator_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "operators", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          name: {
            type: DataTypes.STRING,
            allowNull: false,
          },
          sku: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
          },
          price_cents: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          image_url: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          category: {
            type: DataTypes.ENUM("pantry", "fridge", "freezer"),
            allowNull: false,
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

      await queryInterface.addIndex("products", ["operator_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("products", { transaction })
    })
  },
}

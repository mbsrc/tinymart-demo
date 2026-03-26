import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "stores",
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
          location_name: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          address: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          status: {
            type: DataTypes.ENUM("online", "offline", "maintenance"),
            allowNull: false,
            defaultValue: "offline",
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

      await queryInterface.addIndex("stores", ["operator_id"], { transaction })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("stores", { transaction })
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_stores_status"',
        { transaction },
      )
    })
  },
}

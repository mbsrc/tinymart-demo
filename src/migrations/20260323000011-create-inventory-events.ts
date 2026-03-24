import type { QueryInterface } from "sequelize"
import { DataTypes } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "inventory_events",
        {
          id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false,
          },
          store_product_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "store_products", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          event_type: {
            type: DataTypes.ENUM("restock", "reserve", "release", "deduct", "adjustment"),
            allowNull: false,
          },
          quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          version: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          reference_id: {
            type: DataTypes.UUID,
            allowNull: true,
          },
          reference_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
          },
          metadata: {
            type: DataTypes.JSONB,
            allowNull: true,
          },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
          },
        },
        { transaction },
      )

      await queryInterface.addIndex("inventory_events", ["store_product_id", "version"], {
        unique: true,
        transaction,
      })

      await queryInterface.addIndex("inventory_events", ["reference_id", "reference_type"], {
        transaction,
      })
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("inventory_events", { transaction })
      await queryInterface.sequelize.query(
        'DROP TYPE IF EXISTS "enum_inventory_events_event_type"',
        { transaction },
      )
    })
  },
}

import type { QueryInterface } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.renameColumn(
        "sessions",
        "stripe_customer_id",
        "stripe_payment_method_id",
        { transaction },
      )
    })
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.renameColumn(
        "sessions",
        "stripe_payment_method_id",
        "stripe_customer_id",
        { transaction },
      )
    })
  },
}

import type { QueryInterface } from "sequelize"

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.renameColumn("sessions", "stripe_customer_id", "stripe_payment_method_id")
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.renameColumn("sessions", "stripe_payment_method_id", "stripe_customer_id")
  },
}

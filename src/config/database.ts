import type { Options } from "sequelize"
import { config } from "./index.js"

const dialectOptions =
  config.nodeEnv === "production" ? { ssl: { require: true, rejectUnauthorized: false } } : {}

export const databaseConfig: Options = {
  dialect: "postgres",
  logging: false,
  dialectOptions,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
}

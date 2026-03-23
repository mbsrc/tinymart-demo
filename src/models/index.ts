import { Sequelize } from "sequelize"
import { databaseConfig } from "../config/database.js"
import { config } from "../config/index.js"

export const sequelize = new Sequelize(config.databaseUrl, databaseConfig)

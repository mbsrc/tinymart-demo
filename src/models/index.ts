import { Sequelize } from "sequelize"
import { databaseConfig } from "../config/database.js"
import { config } from "../config/index.js"
import { IdempotencyKey } from "./IdempotencyKey.js"
import { JobFailure } from "./JobFailure.js"
import { Operator } from "./Operator.js"
import { Product } from "./Product.js"
import { Session } from "./Session.js"
import { SessionItem } from "./SessionItem.js"
import { Store } from "./Store.js"
import { StoreProduct } from "./StoreProduct.js"
import { Transaction } from "./Transaction.js"

export const sequelize = new Sequelize(config.databaseUrl, databaseConfig)

const models = {
  Operator,
  Store,
  Product,
  StoreProduct,
  Session,
  SessionItem,
  Transaction,
  IdempotencyKey,
  JobFailure,
}

for (const model of Object.values(models)) {
  model.initialize(sequelize)
}

for (const model of Object.values(models)) {
  model.associate(models)
}

export {
  Operator,
  Store,
  Product,
  StoreProduct,
  Session,
  SessionItem,
  Transaction,
  IdempotencyKey,
  JobFailure,
}

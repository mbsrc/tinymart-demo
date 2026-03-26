require("dotenv/config")
module.exports = {
  development: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    logging: false,
    seederStorage: "sequelize",
  },
  test: {
    url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
    dialect: "postgres",
    logging: false,
    seederStorage: "sequelize",
  },
  production: {
    url: process.env.DATABASE_URL,
    dialect: "postgres",
    dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    logging: false,
    seederStorage: "sequelize",
  },
}

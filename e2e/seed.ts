import fs from "node:fs/promises"
// Runs under tsx to handle TypeScript model imports with `declare` fields
import path from "node:path"
import { fileURLToPath } from "node:url"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, "..")

process.env.DATABASE_URL = "postgresql://tinymart:tinymart@localhost:5432/tinymart_e2e"
process.env.STRIPE_SECRET_KEY = "sk_test_fake_e2e_key"
process.env.PORT = "3001"
process.env.NODE_ENV = "test"
process.env.E2E_MOCK_STRIPE = "true"

const { sequelize, Store } = await import(path.join(rootDir, "src/models/index.js"))
const seeder = (await import(path.join(rootDir, "src/seeders/20260323000001-demo-data.js"))).default

await sequelize.sync({ force: true })
await seeder.up(sequelize.getQueryInterface())

const stores = await Store.findAll({ order: [["name", "ASC"]] })
const testData = {
  stores: stores.map((s: { id: string; name: string }) => ({
    id: s.id,
    name: s.name,
  })),
}

await fs.writeFile(path.join(dirname, ".test-data.json"), JSON.stringify(testData, null, 2))

await sequelize.close()
console.log(`E2E seed complete — ${stores.length} stores`)

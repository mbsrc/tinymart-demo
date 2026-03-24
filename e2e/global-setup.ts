import { execSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, "..")

export default function globalSetup() {
  execSync(`npx tsx ${path.join(dirname, "seed.ts")}`, {
    cwd: rootDir,
    stdio: "inherit",
  })
}

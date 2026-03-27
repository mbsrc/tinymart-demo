import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, "..")

const CI = !!process.env.CI
const API_PORT = "3002"
const UI_PORT = "5174"

const apiEnv = {
  PORT: API_PORT,
  DATABASE_URL: "postgresql://tinymart:tinymart@localhost:5432/tinymart_e2e",
  STRIPE_SECRET_KEY: "sk_test_fake_e2e_key",
  E2E_MOCK_STRIPE: "true",
  NODE_ENV: "test",
}

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: CI ? 1 : 0,
  workers: 1,
  reporter: CI ? "github" : "list",
  outputDir: "test-results",

  use: {
    baseURL: `http://localhost:${UI_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      command: "npx tsx watch src/server.ts",
      port: Number(API_PORT),
      reuseExistingServer: false,
      timeout: 30_000,
      env: apiEnv,
      cwd: rootDir,
    },
    {
      command: `bunx vite --port ${UI_PORT}`,
      port: Number(UI_PORT),
      reuseExistingServer: false,
      timeout: 15_000,
      env: { VITE_API_PORT: API_PORT, VITE_STRIPE_PUBLISHABLE_KEY: "" },
      cwd: path.join(rootDir, "client"),
    },
  ],

  globalSetup: "./global-setup.ts",
})

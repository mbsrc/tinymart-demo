import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { test as base, expect } from "@playwright/test"

const dirname = path.dirname(fileURLToPath(import.meta.url))

interface TestData {
  stores: Array<{ id: string; name: string }>
}

function loadTestData(): TestData {
  const raw = fs.readFileSync(path.join(dirname, ".test-data.json"), "utf-8")
  return JSON.parse(raw)
}

interface Fixtures {
  testData: TestData
  storeId: string
}

export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright fixture API requires empty destructuring
  testData: async ({}, use) => {
    await use(loadTestData())
  },

  storeId: async ({ testData }, use) => {
    const downtown = testData.stores.find((s) => s.name === "Downtown Fridge")
    if (!downtown) throw new Error("Downtown Fridge not found in test data")
    await use(downtown.id)
  },

  // Clear localStorage before each test for fresh auth state
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.clear()
    })
    await use(page)
  },
})

export { expect }

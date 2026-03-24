import type { Page } from "@playwright/test"
import { API_KEY } from "./constants"

export async function authenticate(page: Page, apiKey = API_KEY) {
  await page.getByPlaceholder("Paste your API key").fill(apiKey)
  await page.getByRole("button", { name: /connect/i }).click()
  await page.waitForSelector("text=Dashboard")
}

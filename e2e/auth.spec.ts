import { expect, test } from "./fixtures"
import { authenticate } from "./helpers/auth"
import { API_KEY } from "./helpers/constants"

test.describe("Auth flow", () => {
  test("shows API key prompt on first visit", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText("Connect to TinyMart")).toBeVisible()
    await expect(page.getByPlaceholder("Paste your API key")).toBeVisible()
    await expect(page.getByRole("button", { name: /connect/i })).toBeVisible()
  })

  test("shows error for invalid API key", async ({ page }) => {
    await page.goto("/")
    await page.getByPlaceholder("Paste your API key").fill("bad-key-123")
    await page.getByRole("button", { name: /connect/i }).click()
    await expect(page.getByText(/invalid api key/i)).toBeVisible()
  })

  test("valid API key loads dashboard", async ({ page }) => {
    await page.goto("/")
    await authenticate(page)
    await expect(page.getByText("Connect to TinyMart")).not.toBeVisible()
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()
  })

  test("sidebar shows connected indicator", async ({ page }) => {
    await page.goto("/")
    await authenticate(page)
    await expect(page.getByText("Connected")).toBeVisible()
  })

  test("disconnect returns to API key prompt", async ({ page }) => {
    await page.goto("/")
    await authenticate(page)
    await page.getByRole("button", { name: /disconnect/i }).click()
    await expect(page.getByText("Connect to TinyMart")).toBeVisible()
  })

  test("API key persists across navigation", async ({ page }) => {
    await page.goto("/")
    await authenticate(page)

    // Navigate to health page and back
    await page.getByRole("link", { name: /system health/i }).click()
    await expect(page.getByRole("heading", { name: /system health/i })).toBeVisible()

    await page.getByRole("link", { name: /dashboard/i }).click()
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()

    // Should not see the prompt
    await expect(page.getByText("Connect to TinyMart")).not.toBeVisible()
  })
})

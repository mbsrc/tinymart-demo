import { expect, test } from "./fixtures"
import { authenticate } from "./helpers/auth"

test.describe("Health page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await authenticate(page)
    await page.getByRole("link", { name: /system health/i }).click()
  })

  test("shows system health heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /system health/i })).toBeVisible()
  })

  test("shows overall status", async ({ page }) => {
    // Should show either "All Systems Healthy" or "Degraded"
    const healthy = page.getByText("All Systems Healthy")
    const degraded = page.getByText("Degraded")
    await expect(healthy.or(degraded)).toBeVisible()
  })

  test("shows dependencies section", async ({ page }) => {
    await expect(page.getByText("Dependencies")).toBeVisible()
    // Should show at least the database dependency
    await expect(page.getByText("database")).toBeVisible()
  })

  test("shows circuit breaker panel", async ({ page }) => {
    await expect(page.getByText(/circuit breaker/i)).toBeVisible()
  })

  test("shows system metrics", async ({ page }) => {
    await expect(page.getByText(/uptime/i)).toBeVisible()
    await expect(page.getByText(/memory/i).first()).toBeVisible()
  })

  test("shows last updated timestamp", async ({ page }) => {
    await expect(page.getByText(/last updated/i)).toBeVisible()
  })
})

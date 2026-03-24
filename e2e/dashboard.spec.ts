import { expect, test } from "./fixtures"
import { authenticate } from "./helpers/auth"

test.describe("Dashboard flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await authenticate(page)
  })

  test("shows both seeded stores", async ({ page }) => {
    const mainContent = page.locator("main")
    await expect(mainContent.getByText("Downtown Fridge")).toBeVisible()
    await expect(mainContent.getByText("Campus Market")).toBeVisible()
  })

  test("store cards show product count", async ({ page }) => {
    const mainContent = page.locator("main")
    await expect(mainContent.getByText("10 products").first()).toBeVisible()
  })

  test("create new store via modal", async ({ page }) => {
    await page.getByRole("button", { name: /new store/i }).click()
    await expect(page.getByRole("heading", { name: /create store/i })).toBeVisible()

    await page.getByLabel(/name/i).fill("Test E2E Store")
    await page.getByLabel(/location/i).fill("E2E Location")
    await page.getByLabel(/address/i).fill("789 Test Ave")
    await page.getByRole("button", { name: /create/i }).click()

    // New store should appear
    const mainContent = page.locator("main")
    await expect(mainContent.getByText("Test E2E Store")).toBeVisible()
  })

  test("click store card navigates to detail", async ({ page }) => {
    const mainContent = page.locator("main")
    await mainContent.getByText("Downtown Fridge").click()
    await expect(page).toHaveURL(/\/stores\//)
    await expect(page.getByRole("heading", { name: /downtown fridge/i })).toBeVisible()
  })

  test("sidebar has kiosk links for stores", async ({ page }) => {
    const sidebar = page.locator("nav")
    await expect(sidebar.getByText("Downtown Fridge")).toBeVisible()
    await expect(sidebar.getByText("Campus Market")).toBeVisible()
  })
})

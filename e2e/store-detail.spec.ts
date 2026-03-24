import { expect, test } from "./fixtures"
import { authenticate } from "./helpers/auth"

test.describe("Store detail flow", () => {
  test.beforeEach(async ({ page, storeId }) => {
    await page.goto("/")
    await authenticate(page)
    // Navigate to Downtown Fridge detail
    const mainContent = page.locator("main")
    await mainContent.getByText("Downtown Fridge").click()
    await expect(page).toHaveURL(`/stores/${storeId}`)
  })

  test("shows store heading and status badge", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /downtown fridge/i })).toBeVisible()
    await expect(page.getByText("online")).toBeVisible()
  })

  test("product table shows seeded products", async ({ page }) => {
    await expect(page.getByText("Bottled Water")).toBeVisible()
    await expect(page.getByText("Cola")).toBeVisible()
    await expect(page.getByText("Energy Bar")).toBeVisible()
    const rows = page.locator("tbody tr")
    await expect(rows).toHaveCount(10)
  })

  test("product table has expected columns", async ({ page }) => {
    const headers = page.locator("thead th")
    // Product, SKU, Category, Price, Qty, Threshold, Status, (edit column)
    await expect(headers).toHaveCount(8)
    await expect(page.locator("thead").getByText("Product")).toBeVisible()
    await expect(page.locator("thead").getByText("SKU")).toBeVisible()
    await expect(page.locator("thead").getByText("Price")).toBeVisible()
  })

  test("edit inventory via modal", async ({ page }) => {
    // Click edit on first product row
    const firstEditButton = page.getByRole("button", { name: /edit/i }).first()
    await firstEditButton.click()

    // Modal should appear with "Edit Inventory" title
    await expect(page.getByRole("heading", { name: /edit inventory/i })).toBeVisible()

    // Change quantity to a unique number
    const qtyInput = page.getByLabel(/quantity on hand/i)
    await qtyInput.clear()
    await qtyInput.fill("77")

    await page.getByRole("button", { name: /save/i }).click()

    // Modal should close, table should show updated quantity
    await expect(page.getByRole("heading", { name: /edit inventory/i })).not.toBeVisible()
    // Find the qty in the first product row
    const firstRow = page.locator("tbody tr").first()
    await expect(firstRow.getByText("77")).toBeVisible()
  })

  test("back to dashboard link works", async ({ page }) => {
    await page.getByRole("link", { name: /back to dashboard/i }).click()
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible()
  })
})

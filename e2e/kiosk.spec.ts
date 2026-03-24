import { expect, test } from "./fixtures"

test.describe("Kiosk shopping flow", () => {
  test("shows store name and Tap to Start", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await expect(page.getByText("Downtown Fridge")).toBeVisible()
    await expect(page.getByRole("button", { name: /tap to start/i })).toBeVisible()
  })

  test("tap start shows product grid and empty cart", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()
    await expect(page.getByText("Your cart is empty")).toBeVisible()
    // Product grid should show at least one product
    await expect(page.getByText("Bottled Water")).toBeVisible()
  })

  test("add product to cart updates sidebar", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Click a product to add it
    await page.getByRole("button", { name: /bottled water/i }).click()

    // Cart should show the item with price
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()
    await expect(cartSection.getByText("$1.99 each")).toBeVisible()
  })

  test("adding same product increments quantity", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Add same product twice
    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()

    // Wait for first add to settle, then click the + in cart
    await page.getByRole("button", { name: /bottled water/i }).click()

    // Quantity should be 2
    await expect(cartSection.getByText("2")).toBeVisible()
  })

  test("cart plus button increments quantity", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()

    // Click + in cart
    await cartSection.getByRole("button", { name: "+" }).click()
    await expect(cartSection.getByText("2")).toBeVisible()
  })

  test("cart minus button decrements quantity", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Add product twice via grid
    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()

    await cartSection.getByRole("button", { name: "+" }).click()
    await expect(cartSection.getByText("2")).toBeVisible()

    // Click - in cart
    await cartSection.getByRole("button", { name: "-" }).click()
    await expect(cartSection.getByText("1")).toBeVisible()
  })

  test("removing last item empties cart and disables close button", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()

    // Remove the item
    await cartSection.getByRole("button", { name: "-" }).click()
    await expect(page.getByText("Your cart is empty")).toBeVisible()

    // Close button should be disabled
    await expect(page.getByRole("button", { name: /close door/i })).toBeDisabled()
  })

  test("full checkout flow: add items → close → receipt", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Add two different products
    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()

    await page.getByRole("button", { name: /energy bar/i }).click()
    await expect(cartSection.getByText("Energy Bar")).toBeVisible()

    // Close door
    await page.getByRole("button", { name: /close door & pay/i }).click()

    // Should show receipt
    await expect(page.getByText("Payment Complete")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Bottled Water x 1")).toBeVisible()
    await expect(page.getByText("Energy Bar x 1")).toBeVisible()
    await expect(page.getByRole("button", { name: /new session/i })).toBeVisible()
  })

  test("receipt total is correct", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Add Bottled Water ($1.99) and Energy Bar ($1.99)
    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()
    await page.getByRole("button", { name: /energy bar/i }).click()
    await expect(cartSection.getByText("Energy Bar")).toBeVisible()

    await page.getByRole("button", { name: /close door & pay/i }).click()
    await expect(page.getByText("Payment Complete")).toBeVisible({ timeout: 15_000 })

    // Total should be $3.98
    await expect(page.getByText("$3.98")).toBeVisible()
  })

  test("new session returns to idle", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Quick checkout
    await page.getByRole("button", { name: /bottled water/i }).click()
    const cartSection = page.locator(".border-l")
    await expect(cartSection.getByText("Bottled Water")).toBeVisible()
    await page.getByRole("button", { name: /close door & pay/i }).click()
    await expect(page.getByText("Payment Complete")).toBeVisible({ timeout: 15_000 })

    // Click new session
    await page.getByRole("button", { name: /new session/i }).click()
    await expect(page.getByRole("button", { name: /tap to start/i })).toBeVisible()
  })

  test("dashboard link works from idle phase", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await expect(page.getByRole("button", { name: /tap to start/i })).toBeVisible()

    await page.getByRole("link", { name: /dashboard/i }).click()
    // Should navigate to dashboard (may show API key prompt since no key set in kiosk)
    await expect(page).toHaveURL("/")
  })

  test("dashboard link works from shopping phase", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    await page.getByRole("link", { name: /dashboard/i }).click()
    await expect(page).toHaveURL("/")
  })

  test("multiple products from different categories display", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible()

    // Check products from each category exist
    await expect(page.getByText("Bottled Water")).toBeVisible() // fridge
    await expect(page.getByText("Energy Bar")).toBeVisible() // pantry
    await expect(page.getByText("Ice Cream Bar")).toBeVisible() // freezer
  })

  test("close door button disabled when cart is empty", async ({ page, storeId }) => {
    await page.goto(`/kiosk/${storeId}`)
    await page.getByRole("button", { name: /tap to start/i }).click()
    await expect(page.getByText("Your cart is empty")).toBeVisible()
    await expect(page.getByRole("button", { name: /close door & pay/i })).toBeDisabled()
  })
})

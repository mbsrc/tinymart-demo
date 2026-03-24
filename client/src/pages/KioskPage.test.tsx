import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { renderWithProviders } from "../test/render"
import KioskPage from "./KioskPage"

function renderKiosk(storeId = "store-1") {
  return renderWithProviders(
    <Routes>
      <Route path="/kiosk/:storeId" element={<KioskPage />} />
    </Routes>,
    { route: `/kiosk/${storeId}` },
  )
}

describe("KioskPage", () => {
  it("shows the store name and tap-to-start button", async () => {
    renderKiosk()
    expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /tap to start/i })).toBeInTheDocument()
  })

  it("shows dashboard link on idle screen", async () => {
    renderKiosk()
    await screen.findByText("Downtown Fridge")
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument()
  })

  it("shows error for unknown store", async () => {
    renderKiosk("store-unknown")
    expect(await screen.findByText(/store not found/i)).toBeInTheDocument()
  })

  it("transitions to shopping phase on start", async () => {
    const user = userEvent.setup()
    renderKiosk()

    const startBtn = await screen.findByRole("button", { name: /tap to start/i })
    await user.click(startBtn)

    // Shopping phase shows product grid and cart
    expect(await screen.findByText("Your Cart")).toBeInTheDocument()
    expect(screen.getByText("Bottled Water")).toBeInTheDocument()
    expect(screen.getByText("Energy Bar")).toBeInTheDocument()
  })

  it("adds items to cart when clicking product", async () => {
    const user = userEvent.setup()
    renderKiosk()

    await user.click(await screen.findByRole("button", { name: /tap to start/i }))
    await screen.findByText("Your Cart")

    // Cart should start empty
    expect(screen.getByText("Your cart is empty")).toBeInTheDocument()

    // Click a product to add it
    const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0)
    expect(addButton).toBeDefined()
    await user.click(addButton as HTMLElement)

    // Item should appear in the cart
    await waitFor(() => {
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })
  })

  it("disables close button when cart is empty", async () => {
    const user = userEvent.setup()
    renderKiosk()

    await user.click(await screen.findByRole("button", { name: /tap to start/i }))
    await screen.findByText("Your Cart")

    const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
    expect(closeBtn).toBeDisabled()
  })

  it("shows receipt after closing session", async () => {
    const user = userEvent.setup()
    renderKiosk()

    // Start session
    await user.click(await screen.findByRole("button", { name: /tap to start/i }))
    await screen.findByText("Your Cart")

    // Add an item
    const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0)
    expect(addButton).toBeDefined()
    await user.click(addButton as HTMLElement)

    // Wait for cart to populate
    await waitFor(() => {
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })

    // Close session
    const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
    await waitFor(() => expect(closeBtn).not.toBeDisabled())
    await user.click(closeBtn)

    // Receipt phase
    expect(await screen.findByText(/payment complete/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /new session/i })).toBeInTheDocument()
  })

  it("returns to idle after clicking new session on receipt", async () => {
    const user = userEvent.setup()
    renderKiosk()

    // Start → add item → close
    await user.click(await screen.findByRole("button", { name: /tap to start/i }))
    await screen.findByText("Your Cart")
    const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0)
    expect(addButton).toBeDefined()
    await user.click(addButton as HTMLElement)
    await waitFor(() => {
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })
    const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
    await waitFor(() => expect(closeBtn).not.toBeDisabled())
    await user.click(closeBtn)

    // On receipt, click "New Session"
    await user.click(await screen.findByRole("button", { name: /new session/i }))

    // Back to idle with Tap to Start
    expect(await screen.findByRole("button", { name: /tap to start/i })).toBeInTheDocument()
  })
})

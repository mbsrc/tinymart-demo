import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { renderWithProviders } from "../test/render"
import StoreDetailPage from "./StoreDetailPage"

function renderStoreDetail(storeId = "store-1") {
  return renderWithProviders(
    <Routes>
      <Route path="/stores/:id" element={<StoreDetailPage />} />
    </Routes>,
    { route: `/stores/${storeId}`, apiKey: "test-key" },
  )
}

describe("StoreDetailPage", () => {
  describe("loading and display", () => {
    it("shows store name and status", async () => {
      renderStoreDetail()
      expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
      expect(screen.getByText("online")).toBeInTheDocument()
    })

    it("shows store location and address", async () => {
      renderStoreDetail()
      expect(await screen.findByText("Urban convenience")).toBeInTheDocument()
      expect(screen.getByText("123 Main St")).toBeInTheDocument()
    })

    it("shows back to dashboard link", async () => {
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      const backLink = screen.getByRole("link", { name: /back to dashboard/i })
      expect(backLink).toHaveAttribute("href", "/")
    })

    it("shows add product button", async () => {
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      expect(screen.getByRole("button", { name: /add product/i })).toBeInTheDocument()
    })
  })

  describe("product table", () => {
    it("shows products with names and SKUs", async () => {
      renderStoreDetail()
      expect(await screen.findByText("Bottled Water")).toBeInTheDocument()
      expect(screen.getByText("WAT-001")).toBeInTheDocument()
      expect(screen.getByText("Energy Bar")).toBeInTheDocument()
      expect(screen.getByText("BAR-001")).toBeInTheDocument()
    })

    it("shows product prices", async () => {
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      expect(screen.getByText("$1.99")).toBeInTheDocument()
      expect(screen.getByText("$2.99")).toBeInTheDocument()
    })

    it("shows inventory quantities", async () => {
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      expect(screen.getByText("15")).toBeInTheDocument() // Bottled Water qty
      expect(screen.getByText("2")).toBeInTheDocument() // Energy Bar qty
    })

    it("shows low stock warning for items below threshold", async () => {
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      // Energy Bar: qty=2, threshold=5 → low stock
      expect(screen.getByText("Low Stock")).toBeInTheDocument()
      // Bottled Water: qty=15, threshold=3 → in stock
      expect(screen.getByText("In Stock")).toBeInTheDocument()
    })

    it("shows category badges", async () => {
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      expect(screen.getByText("fridge")).toBeInTheDocument()
      expect(screen.getByText("pantry")).toBeInTheDocument()
    })

    it("shows edit buttons for each product", async () => {
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      expect(editButtons.length).toBe(2)
    })
  })

  describe("empty store", () => {
    it("shows empty state for store with no products", async () => {
      renderStoreDetail("store-2")
      expect(await screen.findByText("No products")).toBeInTheDocument()
      expect(screen.getByText("Add products to this store to start selling.")).toBeInTheDocument()
    })

    it("shows add product button in empty state", async () => {
      renderStoreDetail("store-2")
      await screen.findByText("No products")
      // Two "Add Product" buttons: one in header, one in empty state
      const buttons = screen.getAllByRole("button", { name: /add product/i })
      expect(buttons.length).toBe(2)
    })
  })

  describe("error state", () => {
    it("shows error for unknown store", async () => {
      renderStoreDetail("store-unknown")
      expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Store not found")).toBeInTheDocument()
    })

    it("shows retry button on error", async () => {
      renderStoreDetail("store-unknown")
      await screen.findByText("Something went wrong")
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe("edit inventory modal", () => {
    it("opens edit modal when clicking edit button", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      await user.click(editButtons[0] as HTMLElement)

      expect(await screen.findByText("Edit Inventory")).toBeInTheDocument()
    })

    it("pre-fills current quantity and threshold", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      await user.click(editButtons[0] as HTMLElement)

      await screen.findByText("Edit Inventory")
      const qtyInput = screen.getByLabelText(/quantity on hand/i) as HTMLInputElement
      const thresholdInput = screen.getByLabelText(/low stock threshold/i) as HTMLInputElement
      expect(qtyInput.value).toBe("15")
      expect(thresholdInput.value).toBe("3")
    })

    it("shows product name in edit modal", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      await user.click(editButtons[0] as HTMLElement)

      await screen.findByText("Edit Inventory")
      // Product name shown as context in the modal
      const modalProductNames = screen.getAllByText("Bottled Water")
      expect(modalProductNames.length).toBeGreaterThanOrEqual(2) // table + modal
    })

    it("submits and closes on save", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      await user.click(editButtons[0] as HTMLElement)

      await screen.findByText("Edit Inventory")
      const qtyInput = screen.getByLabelText(/quantity on hand/i)
      await user.clear(qtyInput)
      await user.type(qtyInput, "20")
      await user.click(screen.getByRole("button", { name: /save changes/i }))

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Edit Inventory")).not.toBeInTheDocument()
      })
    })
  })

  describe("add product modal", () => {
    it("opens add product modal", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /add product/i }))

      expect(await screen.findByText("Add Product to Store")).toBeInTheDocument()
    })

    it("shows product dropdown and quantity fields", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /add product/i }))

      await screen.findByText("Add Product to Store")
      expect(screen.getByLabelText(/product/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/initial quantity/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/low stock threshold/i)).toBeInTheDocument()
    })

    it("disables submit when no product selected", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /add product/i }))

      await screen.findByText("Add Product to Store")
      expect(screen.getByRole("button", { name: /add to store/i })).toBeDisabled()
    })

    it("shows create new product link", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /add product/i }))

      await screen.findByText("Add Product to Store")
      expect(screen.getByText(/create new product/i)).toBeInTheDocument()
    })
  })

  describe("modal close behaviors", () => {
    it("closes edit modal with Escape key", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Bottled Water")
      const editButtons = screen.getAllByRole("button", { name: /edit/i })
      await user.click(editButtons[0] as HTMLElement)

      await screen.findByText("Edit Inventory")
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(screen.queryByText("Edit Inventory")).not.toBeInTheDocument()
      })
    })

    it("closes add product modal with Escape key", async () => {
      const user = userEvent.setup()
      renderStoreDetail()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /add product/i }))

      await screen.findByText("Add Product to Store")
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(screen.queryByText("Add Product to Store")).not.toBeInTheDocument()
      })
    })
  })
})

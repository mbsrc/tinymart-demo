import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { mockProduct1, mockProduct2 } from "../../test/mocks/data"
import type { CartLine } from "../../utils/reconcileCart"
import { CartSidebar } from "./CartSidebar"

const productMap = new Map([
  [mockProduct1.id, mockProduct1],
  [mockProduct2.id, mockProduct2],
])

const defaultProps = {
  productMap,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onClose: vi.fn(),
  closing: false,
}

describe("CartSidebar", () => {
  describe("empty state", () => {
    it("shows empty cart message when no items", () => {
      render(<CartSidebar {...defaultProps} lines={[]} />)
      expect(screen.getByText("Your cart is empty")).toBeInTheDocument()
    })

    it("enables close button when cart is empty", () => {
      render(<CartSidebar {...defaultProps} lines={[]} />)
      expect(screen.getByRole("button", { name: /close door/i })).not.toBeDisabled()
    })
  })

  describe("item display", () => {
    it("shows cart items with names", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 2 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByText("Bottled Water")).toBeInTheDocument()
    })

    it("shows item quantities", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 3 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByText("3")).toBeInTheDocument()
    })

    it("shows per-item price", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByText("$1.99 each")).toBeInTheDocument()
    })

    it("renders multiple items", () => {
      const lines: CartLine[] = [
        { product_id: "prod-1", quantity: 1 },
        { product_id: "prod-2", quantity: 2 },
      ]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByText("Bottled Water")).toBeInTheDocument()
      expect(screen.getByText("Energy Bar")).toBeInTheDocument()
    })

    it("skips items not in productMap", () => {
      const lines: CartLine[] = [{ product_id: "unknown-prod", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      // No product renders, but also no crash
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })
  })

  describe("total calculation", () => {
    it("calculates total for single item", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 2 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByText("$3.98")).toBeInTheDocument()
    })

    it("calculates total for multiple items", () => {
      const lines: CartLine[] = [
        { product_id: "prod-1", quantity: 2 },
        { product_id: "prod-2", quantity: 1 },
      ]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      // 2 * $1.99 + 1 * $2.99 = $6.97
      expect(screen.getByText("$6.97")).toBeInTheDocument()
    })

    it("shows $0.00 for empty cart", () => {
      render(<CartSidebar {...defaultProps} lines={[]} />)
      expect(screen.getByText("$0.00")).toBeInTheDocument()
    })
  })

  describe("remove button", () => {
    it("remove button is clickable at quantity 1", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      const removeBtn = screen.getByRole("button", { name: "-" })
      expect(removeBtn).not.toBeDisabled()
    })

    it("remove button is clickable at quantity > 1", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 2 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      const removeBtn = screen.getByRole("button", { name: "-" })
      expect(removeBtn).not.toBeDisabled()
    })

    it("calls onRemove when minus button clicked", async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 2 }]
      render(<CartSidebar {...defaultProps} lines={lines} onRemove={onRemove} />)
      await user.click(screen.getByRole("button", { name: "-" }))
      expect(onRemove).toHaveBeenCalledWith("prod-1")
    })

    it("calls onRemove at quantity 1 to allow full removal", async () => {
      const user = userEvent.setup()
      const onRemove = vi.fn()
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} onRemove={onRemove} />)
      await user.click(screen.getByRole("button", { name: "-" }))
      expect(onRemove).toHaveBeenCalledWith("prod-1")
    })
  })

  describe("add button", () => {
    it("calls onAdd when plus button clicked", async () => {
      const user = userEvent.setup()
      const onAdd = vi.fn()
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} onAdd={onAdd} />)
      await user.click(screen.getByRole("button", { name: "+" }))
      expect(onAdd).toHaveBeenCalledWith("prod-1")
    })
  })

  describe("close button", () => {
    it("enables close button when cart has items", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} />)
      expect(screen.getByRole("button", { name: /close door & pay/i })).not.toBeDisabled()
    })

    it("calls onClose when close button clicked", async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} onClose={onClose} />)
      await user.click(screen.getByRole("button", { name: /close door & pay/i }))
      expect(onClose).toHaveBeenCalled()
    })

    it("shows processing state and disables button when closing", () => {
      const lines: CartLine[] = [{ product_id: "prod-1", quantity: 1 }]
      render(<CartSidebar {...defaultProps} lines={lines} closing={true} />)
      expect(screen.getByRole("button", { name: /processing/i })).toBeDisabled()
    })
  })
})

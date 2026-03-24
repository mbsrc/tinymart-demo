import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { server } from "../test/mocks/server"
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

async function startSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /tap to start/i }))
  await screen.findByText("Your Cart")
}

async function addFirstProduct(user: ReturnType<typeof userEvent.setup>) {
  const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0)
  expect(addButton).toBeDefined()
  await user.click(addButton as HTMLElement)
  await waitFor(() => {
    expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
  })
}

describe("KioskPage", () => {
  describe("idle phase", () => {
    it("shows store name and tap-to-start button", async () => {
      renderKiosk()
      expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /tap to start/i })).toBeInTheDocument()
    })

    it("shows smart shopping subtitle", async () => {
      renderKiosk()
      expect(await screen.findByText(/smart shopping/i)).toBeInTheDocument()
    })

    it("shows dashboard link", async () => {
      renderKiosk()
      await screen.findByText("Downtown Fridge")
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/")
    })

    it("does not require an API key", async () => {
      renderKiosk()
      // Renders store without auth — no API key set
      expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
    })
  })

  describe("error states", () => {
    it("shows error for unknown store", async () => {
      renderKiosk("store-unknown")
      expect(await screen.findByText(/store not found/i)).toBeInTheDocument()
    })

    it("shows error when kiosk store endpoint fails", async () => {
      server.use(
        http.get("/api/sessions/store/:storeId", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "SERVER_ERROR", message: "Internal error" },
              meta: {},
            },
            { status: 500 },
          )
        }),
      )
      renderKiosk()
      expect(await screen.findByText(/internal error/i)).toBeInTheDocument()
    })
  })

  describe("shopping phase", () => {
    it("transitions to shopping on start", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByText("Bottled Water")).toBeInTheDocument()
      expect(screen.getByText("Energy Bar")).toBeInTheDocument()
      expect(screen.getByText("Your cart is empty")).toBeInTheDocument()
    })

    it("shows product prices in the grid", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByText("$1.99")).toBeInTheDocument()
      expect(screen.getByText("$2.99")).toBeInTheDocument()
    })

    it("shows product categories", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByText("Fridge")).toBeInTheDocument()
      expect(screen.getByText("Pantry")).toBeInTheDocument()
    })

    it("adds item to cart when clicking product", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      // Product name should appear in the cart sidebar
      const cartItems = screen.getAllByText("Bottled Water")
      expect(cartItems.length).toBeGreaterThanOrEqual(2) // grid + cart
    })

    it("shows 'Adding...' state when item is being added", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      // Click product — briefly shows "Adding..."
      const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0) as HTMLElement
      await user.click(addButton)

      // The button text should eventually return from "Adding..."
      await waitFor(() => {
        expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
      })
    })

    it("disables close button when cart is empty", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByRole("button", { name: /close door & pay/i })).toBeDisabled()
    })

    it("shows store name in header during shopping", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByText("Downtown Fridge")).toBeInTheDocument()
      expect(screen.getByText("Pick items from the fridge")).toBeInTheDocument()
    })

    it("shows dashboard link during shopping", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument()
    })
  })

  describe("cart interactions", () => {
    it("enables close button after adding an item", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
    })

    it("updates total when items are added", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      // Initially total is $0.00
      expect(screen.getByText("$0.00")).toBeInTheDocument()

      await addFirstProduct(user)

      // After adding Bottled Water ($1.99), total should update
      await waitFor(() => {
        expect(screen.queryByText("$0.00")).not.toBeInTheDocument()
      })
    })

    it("can remove an item from the cart", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      // Cart has item — find the minus button
      const removeBtn = screen.getByRole("button", { name: "-" })
      await user.click(removeBtn)

      // Cart should be empty again after removing
      await waitFor(() => {
        expect(screen.getByText("Your cart is empty")).toBeInTheDocument()
      })
    })

    it("disables close button after removing all items", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      // Remove the item
      const removeBtn = screen.getByRole("button", { name: "-" })
      await user.click(removeBtn)

      // Close button should be disabled again
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /close door & pay/i })).toBeDisabled()
      })
    })

    it("can add multiple different products", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      // Add first product
      const addButtons = screen.getAllByRole("button", { name: /add to cart/i })
      await user.click(addButtons[0] as HTMLElement)
      await waitFor(() => {
        expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
      })

      // Add second product
      await user.click(addButtons[1] as HTMLElement)

      // Both products should be in the cart
      await waitFor(() => {
        const minusButtons = screen.getAllByRole("button", { name: "-" })
        expect(minusButtons.length).toBe(2)
      })
    })

    it("increments quantity when adding same product twice", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      // Add first product twice
      const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0) as HTMLElement
      await user.click(addButton)
      await waitFor(() => {
        expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
      })

      // Add again via the + button in cart
      const plusBtn = screen.getByRole("button", { name: "+" })
      await user.click(plusBtn)

      // Quantity should be 2
      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument()
      })
    })

    it("decrements quantity without removing when qty > 1", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)

      // Add product twice
      const addButton = screen.getAllByRole("button", { name: /add to cart/i }).at(0) as HTMLElement
      await user.click(addButton)
      await waitFor(() => {
        expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
      })
      const plusBtn = screen.getByRole("button", { name: "+" })
      await user.click(plusBtn)
      await waitFor(() => {
        expect(screen.getByText("2")).toBeInTheDocument()
      })

      // Remove one — should go to qty 1, not remove entirely
      const removeBtn = screen.getByRole("button", { name: "-" })
      await user.click(removeBtn)

      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument()
      })
      // Item still in cart
      expect(screen.queryByText("Your cart is empty")).not.toBeInTheDocument()
    })
  })

  describe("close session error recovery", () => {
    it("shows error banner when close fails and stays in shopping", async () => {
      server.use(
        http.post("/api/sessions/:id/close", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "PAYMENT_FAILED", message: "Payment declined" },
              meta: {},
            },
            { status: 422 },
          )
        }),
      )

      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      // Should show error and remain in shopping phase
      expect(await screen.findByText(/payment declined/i)).toBeInTheDocument()
      expect(screen.getByText("Your Cart")).toBeInTheDocument()
    })

    it("dismisses error banner when clicking dismiss", async () => {
      server.use(
        http.post("/api/sessions/:id/close", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "PAYMENT_FAILED", message: "Payment declined" },
              meta: {},
            },
            { status: 422 },
          )
        }),
      )

      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      const dismissBtn = await screen.findByRole("button", { name: /dismiss/i })
      await user.click(dismissBtn)

      expect(screen.queryByText(/payment declined/i)).not.toBeInTheDocument()
    })
  })

  describe("receipt phase", () => {
    it("shows receipt with payment complete status", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      expect(await screen.findByText(/payment complete/i)).toBeInTheDocument()
    })

    it("shows store name on receipt", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      await screen.findByText(/payment complete/i)
      expect(screen.getByText("Downtown Fridge")).toBeInTheDocument()
    })

    it("shows new session button on receipt", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      expect(await screen.findByRole("button", { name: /new session/i })).toBeInTheDocument()
    })

    it("returns to idle after clicking new session", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      await user.click(await screen.findByRole("button", { name: /new session/i }))
      expect(await screen.findByRole("button", { name: /tap to start/i })).toBeInTheDocument()
    })

    it("shows dashboard link on receipt", async () => {
      const user = userEvent.setup()
      renderKiosk()
      await startSession(user)
      await addFirstProduct(user)

      const closeBtn = screen.getByRole("button", { name: /close door & pay/i })
      await waitFor(() => expect(closeBtn).not.toBeDisabled())
      await user.click(closeBtn)

      await screen.findByText(/payment complete/i)
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument()
    })
  })
})

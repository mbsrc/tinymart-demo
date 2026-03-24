import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { server } from "../test/mocks/server"
import { renderWithProviders } from "../test/render"
import DashboardPage from "./DashboardPage"

function renderDashboard(apiKey = "test-key") {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<DashboardPage />} />
    </Routes>,
    { route: "/", apiKey },
  )
}

describe("DashboardPage", () => {
  describe("loading and display", () => {
    it("renders store cards after loading", async () => {
      renderDashboard()
      expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
      expect(screen.getByText("Campus Market")).toBeInTheDocument()
    })

    it("shows dashboard heading and subtitle", async () => {
      renderDashboard()
      expect(await screen.findByText("Dashboard")).toBeInTheDocument()
      expect(screen.getByText("Manage your smart stores")).toBeInTheDocument()
    })

    it("shows New Store button", async () => {
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      expect(screen.getByRole("button", { name: /new store/i })).toBeInTheDocument()
    })

    it("shows store status badges", async () => {
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      const badges = screen.getAllByText("online")
      expect(badges.length).toBe(2)
    })

    it("shows product count on store cards", async () => {
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      expect(screen.getByText("2 products")).toBeInTheDocument()
      expect(screen.getByText("0 products")).toBeInTheDocument()
    })

    it("store cards link to store detail page", async () => {
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      const links = screen.getAllByRole("link")
      const storeLink = links.find((l) => l.getAttribute("href") === "/stores/store-1")
      expect(storeLink).toBeDefined()
    })

    it("shows store location info", async () => {
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      expect(screen.getByText("Urban convenience")).toBeInTheDocument()
      expect(screen.getByText("123 Main St")).toBeInTheDocument()
    })
  })

  describe("empty state", () => {
    it("shows empty state when no stores exist", async () => {
      server.use(
        http.get("/api/stores", ({ request }) => {
          const apiKey = request.headers.get("x-api-key")
          if (!apiKey)
            return HttpResponse.json(
              {
                success: false,
                data: null,
                error: { code: "UNAUTHORIZED", message: "Invalid API key" },
                meta: {},
              },
              { status: 401 },
            )
          return HttpResponse.json({
            success: true,
            data: [],
            error: null,
            meta: { correlation_id: "test", timestamp: new Date().toISOString() },
          })
        }),
      )
      renderDashboard()
      expect(await screen.findByText("No stores yet")).toBeInTheDocument()
      expect(screen.getByText("Create your first smart store to get started.")).toBeInTheDocument()
    })

    it("shows create store button in empty state", async () => {
      server.use(
        http.get("/api/stores", () => {
          return HttpResponse.json({
            success: true,
            data: [],
            error: null,
            meta: { correlation_id: "test", timestamp: new Date().toISOString() },
          })
        }),
      )
      renderDashboard()
      await screen.findByText("No stores yet")
      expect(screen.getByRole("button", { name: /create store/i })).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error when API fails", async () => {
      server.use(
        http.get("/api/stores", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "SERVER_ERROR", message: "Database unavailable" },
              meta: {},
            },
            { status: 500 },
          )
        }),
      )
      renderDashboard()
      expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Database unavailable")).toBeInTheDocument()
    })

    it("shows retry button on error", async () => {
      server.use(
        http.get("/api/stores", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "SERVER_ERROR", message: "Database unavailable" },
              meta: {},
            },
            { status: 500 },
          )
        }),
      )
      renderDashboard()
      await screen.findByText("Something went wrong")
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })
  })

  describe("create store modal", () => {
    it("opens create store modal on button click", async () => {
      const user = userEvent.setup()
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /new store/i }))
      expect(await screen.findByLabelText(/name/i)).toBeInTheDocument()
    })

    it("modal has name, location, and address fields", async () => {
      const user = userEvent.setup()
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /new store/i }))

      expect(await screen.findByLabelText(/name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/address/i)).toBeInTheDocument()
    })

    it("disables submit when name is empty", async () => {
      const user = userEvent.setup()
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /new store/i }))
      await screen.findByLabelText(/name/i)

      const submitBtn = screen.getByRole("button", { name: /create store/i })
      expect(submitBtn).toBeDisabled()
    })

    it("submits and closes modal on success", async () => {
      const user = userEvent.setup()
      renderDashboard()
      await screen.findByText("Downtown Fridge")
      await user.click(screen.getByRole("button", { name: /new store/i }))

      const nameInput = await screen.findByLabelText(/name/i)
      await user.type(nameInput, "Test Store")
      await user.click(screen.getByRole("button", { name: /create store/i }))

      // Modal should close (name input disappears)
      await waitFor(() => {
        expect(screen.queryByLabelText(/^name/i)).not.toBeInTheDocument()
      })
    })
  })
})

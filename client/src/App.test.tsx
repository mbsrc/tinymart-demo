import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { screen, waitFor } from "@testing-library/react"
import { render } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { setApiKey as setClientApiKey } from "./api/client"
import { ApiKeyPrompt } from "./components/ApiKeyPrompt"
import { Layout } from "./components/Layout"
import { ErrorBoundary } from "./components/ui/ErrorBoundary"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import DashboardPage from "./pages/DashboardPage"
import KioskPage from "./pages/KioskPage"

function ProtectedRoutes() {
  const { apiKey } = useAuth()
  return (
    <>
      {!apiKey && <ApiKeyPrompt />}
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </>
  )
}

function renderApp(route: string, apiKey: string | null = null) {
  if (apiKey) {
    localStorage.setItem("tinymart-api-key", apiKey)
  } else {
    localStorage.removeItem("tinymart-api-key")
  }
  setClientApiKey(apiKey)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <Routes>
            <Route
              path="/kiosk/:storeId"
              element={
                <ErrorBoundary>
                  <KioskPage />
                </ErrorBoundary>
              }
            />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("App routing", () => {
  it("shows API key prompt on dashboard when not authenticated", async () => {
    renderApp("/")
    expect(await screen.findByText("Connect to TinyMart")).toBeInTheDocument()
  })

  it("shows dashboard content when authenticated", async () => {
    renderApp("/", "test-key")
    // Store name appears in sidebar kiosk link + store card
    const storeNames = await screen.findAllByText("Downtown Fridge")
    expect(storeNames.length).toBeGreaterThanOrEqual(1)
    // Auth prompt should not be visible
    expect(screen.queryByText("Connect to TinyMart")).not.toBeInTheDocument()
  })

  it("shows sidebar with navigation when authenticated", async () => {
    renderApp("/", "test-key")
    await screen.findAllByText("Downtown Fridge")
    // TinyMart appears in sidebar + mobile header
    expect(screen.getAllByText("TinyMart").length).toBeGreaterThanOrEqual(1)
    // Dashboard appears in sidebar nav + page heading
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("System Health")).toBeInTheDocument()
    expect(screen.getByText("Connected")).toBeInTheDocument()
  })

  it("shows disconnect button when authenticated", async () => {
    renderApp("/", "test-key")
    await screen.findAllByText("Downtown Fridge")
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeInTheDocument()
  })

  it("kiosk route loads without API key", async () => {
    renderApp("/kiosk/store-1")
    // No auth prompt — kiosk is public
    expect(screen.queryByText("Connect to TinyMart")).not.toBeInTheDocument()
    expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /tap to start/i })).toBeInTheDocument()
  })

  it("kiosk route works even with API key set", async () => {
    renderApp("/kiosk/store-1", "test-key")
    expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /tap to start/i })).toBeInTheDocument()
  })

  it("accepts API key and dismisses prompt", async () => {
    const user = userEvent.setup()
    renderApp("/")

    await screen.findByText("Connect to TinyMart")
    await user.type(screen.getByPlaceholderText("Paste your API key"), "valid-key")
    await user.click(screen.getByRole("button", { name: /connect/i }))

    // Prompt should disappear after successful auth
    await waitFor(() => {
      expect(screen.queryByText("Connect to TinyMart")).not.toBeInTheDocument()
    })
    expect(localStorage.getItem("tinymart-api-key")).toBe("valid-key")
  })

  it("disconnect clears API key and shows prompt", async () => {
    const user = userEvent.setup()
    renderApp("/", "test-key")

    await screen.findAllByText("Downtown Fridge")
    await user.click(screen.getByRole("button", { name: /disconnect/i }))

    // Auth prompt should reappear
    expect(await screen.findByText("Connect to TinyMart")).toBeInTheDocument()
    expect(localStorage.getItem("tinymart-api-key")).toBeNull()
  })

  it("sidebar shows kiosk links for each store", async () => {
    renderApp("/", "test-key")
    await screen.findAllByText("Downtown Fridge")

    // Kiosk section header
    expect(screen.getByText("Kiosk")).toBeInTheDocument()
    // Links to kiosk for each store
    const kioskLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/kiosk/"))
    expect(kioskLinks.length).toBe(2)
  })
})

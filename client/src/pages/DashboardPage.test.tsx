import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
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
  it("renders store cards after loading", async () => {
    renderDashboard()
    expect(await screen.findByText("Downtown Fridge")).toBeInTheDocument()
    expect(screen.getByText("Campus Market")).toBeInTheDocument()
  })

  it("shows dashboard heading", async () => {
    renderDashboard()
    expect(await screen.findByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Manage your smart stores")).toBeInTheDocument()
  })

  it("shows New Store button", async () => {
    renderDashboard()
    await screen.findByText("Downtown Fridge")
    expect(screen.getByRole("button", { name: /new store/i })).toBeInTheDocument()
  })

  it("opens create store modal on button click", async () => {
    const user = userEvent.setup()
    renderDashboard()
    await screen.findByText("Downtown Fridge")
    await user.click(screen.getByRole("button", { name: /new store/i }))
    // Modal has a "Name *" label for the store name input
    expect(await screen.findByLabelText(/name/i)).toBeInTheDocument()
  })
})

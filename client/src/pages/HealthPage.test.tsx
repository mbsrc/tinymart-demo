import { screen } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { renderWithProviders } from "../test/render"
import HealthPage from "./HealthPage"

function renderHealth() {
  return renderWithProviders(
    <Routes>
      <Route path="/health" element={<HealthPage />} />
    </Routes>,
    { route: "/health", apiKey: "test-key" },
  )
}

describe("HealthPage", () => {
  it("renders health status after loading", async () => {
    renderHealth()
    expect(await screen.findByText("All Systems Healthy")).toBeInTheDocument()
  })

  it("shows dependency cards", async () => {
    renderHealth()
    await screen.findByText("All Systems Healthy")
    expect(screen.getByText("Dependencies")).toBeInTheDocument()
    expect(screen.getByText("database")).toBeInTheDocument()
    // "stripe" appears in both dependencies and circuit breakers
    expect(screen.getAllByText("stripe").length).toBeGreaterThanOrEqual(1)
  })

  it("shows system metrics section", async () => {
    renderHealth()
    await screen.findByText("All Systems Healthy")
    expect(screen.getByText(/uptime/i)).toBeInTheDocument()
  })
})

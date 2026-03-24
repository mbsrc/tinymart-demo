import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { Route, Routes } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { server } from "../test/mocks/server"
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
  describe("healthy state", () => {
    it("shows all systems healthy badge", async () => {
      renderHealth()
      expect(await screen.findByText("All Systems Healthy")).toBeInTheDocument()
    })

    it("shows system health heading", async () => {
      renderHealth()
      expect(await screen.findByText("System Health")).toBeInTheDocument()
    })

    it("shows last updated time", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText(/last updated/i)).toBeInTheDocument()
    })
  })

  describe("dependencies", () => {
    it("shows dependencies section heading", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("Dependencies")).toBeInTheDocument()
    })

    it("shows database dependency with latency", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("database")).toBeInTheDocument()
      expect(screen.getByText("2ms latency")).toBeInTheDocument()
    })

    it("shows stripe dependency", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getAllByText("stripe").length).toBeGreaterThanOrEqual(1)
    })

    it("shows job queue dependency", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("job queue")).toBeInTheDocument()
    })
  })

  describe("circuit breakers", () => {
    it("shows circuit breakers section", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("Circuit Breakers")).toBeInTheDocument()
    })

    it("shows stripe circuit breaker with failure count", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("0 failures")).toBeInTheDocument()
    })

    it("shows circuit breaker state badge", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("closed")).toBeInTheDocument()
    })
  })

  describe("system metrics", () => {
    it("shows system metrics section", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("System Metrics")).toBeInTheDocument()
    })

    it("shows uptime", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("Uptime")).toBeInTheDocument()
      expect(screen.getByText("1h 0m")).toBeInTheDocument() // 3600 seconds
    })

    it("shows memory metrics", async () => {
      renderHealth()
      await screen.findByText("All Systems Healthy")
      expect(screen.getByText("RSS Memory")).toBeInTheDocument()
      expect(screen.getByText("Heap Used")).toBeInTheDocument()
      expect(screen.getByText("Heap Total")).toBeInTheDocument()
    })
  })

  describe("degraded state", () => {
    it("shows degraded badge when unhealthy", async () => {
      server.use(
        http.get("/health/detailed", () => {
          return HttpResponse.json({
            success: true,
            data: {
              status: "degraded",
              dependencies: {
                database: { status: "healthy", latency_ms: 2 },
                stripe: { status: "unhealthy" },
              },
              circuit_breakers: {
                stripe: { state: "open", failure_count: 5 },
              },
              job_queue: {},
              uptime: 100,
              memory: { rss: 50000000, heap_used: 20000000, heap_total: 30000000 },
            },
            error: null,
            meta: { correlation_id: "test", timestamp: new Date().toISOString() },
          })
        }),
      )
      renderHealth()
      expect(await screen.findByText("Degraded")).toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("shows error when health endpoint fails", async () => {
      server.use(
        http.get("/health/detailed", () => {
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: { code: "SERVER_ERROR", message: "Health check failed" },
              meta: {},
            },
            { status: 500 },
          )
        }),
      )
      renderHealth()
      expect(await screen.findByText("Something went wrong")).toBeInTheDocument()
      expect(screen.getByText("Health check failed")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
    })
  })
})

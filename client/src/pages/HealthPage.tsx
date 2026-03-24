import { CircuitBreakerPanel } from "../components/health/CircuitBreakerPanel"
import { DependencyCard } from "../components/health/DependencyCard"
import { SystemMetrics } from "../components/health/SystemMetrics"
import { ErrorDisplay } from "../components/ui/ErrorDisplay"
import { LoadingSpinner } from "../components/ui/LoadingSpinner"
import { useDetailedHealth } from "../hooks/useHealth"
import { usePageTitle } from "../hooks/usePageTitle"

export default function HealthPage() {
  usePageTitle("System Health")
  const { data: health, isLoading, error, refetch, dataUpdatedAt } = useDetailedHealth()

  if (isLoading) return <LoadingSpinner className="py-20" />
  if (error) return <ErrorDisplay error={error as Error} onRetry={() => refetch()} />
  if (!health) return null

  const isHealthy = health.status === "healthy"
  const deps = Object.entries(health.dependencies)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
            isHealthy ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${isHealthy ? "bg-green-500" : "bg-yellow-500"}`}
          />
          {isHealthy ? "All Systems Healthy" : "Degraded"}
        </span>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Dependencies
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deps.map(([name, dep]) => (
            <DependencyCard key={name} name={name} dep={dep} />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <CircuitBreakerPanel breakers={health.circuit_breakers} />
      </div>

      <div className="mt-6">
        <SystemMetrics uptime={health.uptime} memory={health.memory} />
      </div>
    </div>
  )
}

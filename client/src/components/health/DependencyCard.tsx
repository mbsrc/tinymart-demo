import type { DependencyStatus } from "../../types/api"

const statusColors: Record<string, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  unhealthy: "bg-red-500",
}

interface DependencyCardProps {
  name: string
  dep: DependencyStatus
}

export function DependencyCard({ name, dep }: DependencyCardProps) {
  const dot = statusColors[dep.status] ?? "bg-gray-400"

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <span className="text-sm font-medium capitalize text-gray-900">
            {name.replace("_", " ")}
          </span>
        </div>
        <span className="text-xs capitalize text-gray-500">{dep.status}</span>
      </div>
      {dep.latency_ms !== undefined && (
        <p className="mt-2 text-xs text-gray-400">{dep.latency_ms}ms latency</p>
      )}
    </div>
  )
}

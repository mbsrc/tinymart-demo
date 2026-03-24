import type { CircuitBreakerInfo } from "../../types/api"
import { StatusBadge } from "../ui/StatusBadge"

interface CircuitBreakerPanelProps {
  breakers: Record<string, CircuitBreakerInfo>
}

export function CircuitBreakerPanel({ breakers }: CircuitBreakerPanelProps) {
  const entries = Object.entries(breakers)
  if (entries.length === 0) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        Circuit Breakers
      </h3>
      <div className="space-y-3">
        {entries.map(([name, info]) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-sm font-medium capitalize text-gray-900">{name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {info.failure_count} failure{info.failure_count !== 1 ? "s" : ""}
              </span>
              <StatusBadge status={info.state} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

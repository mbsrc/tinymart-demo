interface SystemMetricsProps {
  uptime: number
  memory: { rss: number; heap_used: number; heap_total: number }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)
  return parts.join(" ")
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function SystemMetrics({ uptime, memory }: SystemMetricsProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
        System Metrics
      </h3>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricItem label="Uptime" value={formatUptime(uptime)} />
        <MetricItem label="RSS Memory" value={formatMB(memory.rss)} />
        <MetricItem label="Heap Used" value={formatMB(memory.heap_used)} />
        <MetricItem label="Heap Total" value={formatMB(memory.heap_total)} />
      </div>
    </div>
  )
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

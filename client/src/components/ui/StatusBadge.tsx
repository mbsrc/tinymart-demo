const colorMap: Record<string, string> = {
  online: "bg-green-100 text-green-800",
  healthy: "bg-green-100 text-green-800",
  ready: "bg-green-100 text-green-800",
  succeeded: "bg-green-100 text-green-800",
  closed: "bg-green-100 text-green-800",
  charged: "bg-green-100 text-green-800",

  degraded: "bg-yellow-100 text-yellow-800",
  half_open: "bg-yellow-100 text-yellow-800",
  pending: "bg-yellow-100 text-yellow-800",
  maintenance: "bg-yellow-100 text-yellow-800",

  offline: "bg-red-100 text-red-800",
  unhealthy: "bg-red-100 text-red-800",
  unavailable: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
  open: "bg-blue-100 text-blue-800",
  refunded: "bg-gray-100 text-gray-800",
}

export function StatusBadge({ status }: { status: string }) {
  const colors = colorMap[status] ?? "bg-gray-100 text-gray-800"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}
    >
      {status.replace("_", " ")}
    </span>
  )
}

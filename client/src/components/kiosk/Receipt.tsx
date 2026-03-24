import type { Product, Session } from "../../types/api"
import { formatCents, formatDate } from "../../utils/format"
import type { CartLine } from "../../utils/reconcileCart"

interface ReceiptProps {
  session: Session
  lines: CartLine[]
  productMap: Map<string, Product>
  storeName: string
  onNewSession: () => void
}

export function Receipt({ session, lines, productMap, storeName, onNewSession }: ReceiptProps) {
  const totalCents = session.Transaction?.total_cents ?? 0
  const status = session.Transaction?.status ?? session.status

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900">{storeName}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {formatDate(session.closed_at ?? session.updated_at)}
          </p>
        </div>

        <div className="mb-6 space-y-2 border-y border-dashed border-gray-300 py-4">
          {lines.map((line) => {
            const product = productMap.get(line.product_id)
            if (!product) return null
            return (
              <div key={line.product_id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {product.name} x {line.quantity}
                </span>
                <span className="font-medium text-gray-900">
                  {formatCents(product.price_cents * line.quantity)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-gray-900">{formatCents(totalCents)}</span>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              status === "succeeded" || status === "charged"
                ? "bg-green-100 text-green-800"
                : status === "pending"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
            }`}
          >
            {status === "succeeded" || status === "charged" ? "Payment Complete" : status}
          </span>
        </div>

        <p className="mb-6 text-center text-xs text-gray-400">Session {session.id.slice(0, 8)}</p>

        <button
          type="button"
          onClick={onNewSession}
          className="w-full rounded-xl bg-blue-600 py-3 text-lg font-bold text-white hover:bg-blue-500"
        >
          New Session
        </button>
      </div>
    </div>
  )
}

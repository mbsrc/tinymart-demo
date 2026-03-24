import type { Product } from "../../types/api"
import { formatCents } from "../../utils/format"
import type { CartLine } from "../../utils/reconcileCart"

interface CartSidebarProps {
  lines: CartLine[]
  productMap: Map<string, Product>
  onAdd: (productId: string) => void
  onRemove: (productId: string) => void
  onClose: () => void
  closing: boolean
}

export function CartSidebar({
  lines,
  productMap,
  onAdd,
  onRemove,
  onClose,
  closing,
}: CartSidebarProps) {
  const totalCents = lines.reduce((sum, line) => {
    const product = productMap.get(line.product_id)
    return sum + (product ? product.price_cents * line.quantity : 0)
  }, 0)

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Your cart is empty</p>
        ) : (
          <div className="space-y-3">
            {lines.map((line) => {
              const product = productMap.get(line.product_id)
              if (!product) return null
              return (
                <div
                  key={line.product_id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{formatCents(product.price_cents)} each</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRemove(line.product_id)}
                      disabled={line.quantity <= 1}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onAdd(line.product_id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 hover:bg-blue-200"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">Total</span>
          <span className="text-2xl font-bold text-gray-900">{formatCents(totalCents)}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={closing || lines.length === 0}
          className="w-full rounded-xl bg-green-600 py-3 text-lg font-bold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
        >
          {closing ? "Processing..." : "Close Door & Pay"}
        </button>
      </div>
    </div>
  )
}

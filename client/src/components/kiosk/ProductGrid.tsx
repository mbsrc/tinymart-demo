import type { StoreProduct } from "../../types/api"
import { formatCents } from "../../utils/format"

const categoryStyles: Record<string, string> = {
  fridge: "border-blue-200 bg-blue-50",
  pantry: "border-amber-200 bg-amber-50",
  freezer: "border-purple-200 bg-purple-50",
}

const categoryIcons: Record<string, string> = {
  fridge: "Fridge",
  pantry: "Pantry",
  freezer: "Freezer",
}

interface ProductGridProps {
  products: StoreProduct[]
  onAdd: (productId: string) => void
  addingId: string | null
}

export function ProductGrid({ products, onAdd, addingId }: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 p-6 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((sp) => {
        const product = sp.Product
        if (!product) return null
        const outOfStock = sp.quantity_on_hand <= 0
        const style = categoryStyles[product.category] ?? "border-gray-200 bg-gray-50"
        const isAdding = addingId === product.id

        return (
          <button
            key={sp.id}
            type="button"
            onClick={() => onAdd(product.id)}
            disabled={outOfStock || isAdding}
            className={`flex flex-col items-center rounded-xl border-2 p-6 text-center transition-all ${style} ${
              outOfStock
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
            }`}
          >
            <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
              {categoryIcons[product.category] ?? product.category}
            </span>
            <span className="text-lg font-semibold text-gray-900">{product.name}</span>
            <span className="mt-1 text-xl font-bold text-gray-800">
              {formatCents(product.price_cents)}
            </span>
            {outOfStock ? (
              <span className="mt-3 text-sm font-medium text-red-500">Out of Stock</span>
            ) : (
              <span className="mt-3 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-blue-600 shadow-sm">
                {isAdding ? "Adding..." : "Add to Cart"}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

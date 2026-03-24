import type { StoreProduct } from "../types/api"
import { formatCents } from "../utils/format"

interface ProductTableProps {
  products: StoreProduct[]
  onEdit: (sp: StoreProduct) => void
}

export function ProductTable({ products, onEdit }: ProductTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              SKU
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Category
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Price
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Qty
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Threshold
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Status
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {products.map((sp) => {
            const product = sp.Product
            if (!product) return null
            const lowStock = sp.quantity_on_hand <= sp.low_stock_threshold

            return (
              <tr key={sp.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                  {product.name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{product.sku}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <CategoryBadge category={product.category} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-900">
                  {formatCents(product.price_cents)}
                </td>
                <td
                  className={`whitespace-nowrap px-4 py-3 text-right text-sm font-medium ${
                    lowStock ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {sp.quantity_on_hand}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-500">
                  {sp.low_stock_threshold}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {lowStock ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      In Stock
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(sp)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const categoryColors: Record<string, string> = {
  fridge: "bg-blue-100 text-blue-800",
  pantry: "bg-amber-100 text-amber-800",
  freezer: "bg-purple-100 text-purple-800",
}

function CategoryBadge({ category }: { category: string }) {
  const colors = categoryColors[category] ?? "bg-gray-100 text-gray-800"
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}
    >
      {category}
    </span>
  )
}

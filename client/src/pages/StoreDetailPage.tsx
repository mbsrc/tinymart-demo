import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { AddProductModal } from "../components/AddProductModal"
import { EditInventoryModal } from "../components/EditInventoryModal"
import { ProductTable } from "../components/ProductTable"
import { EmptyState } from "../components/ui/EmptyState"
import { ErrorDisplay } from "../components/ui/ErrorDisplay"
import { LoadingSpinner } from "../components/ui/LoadingSpinner"
import { StatusBadge } from "../components/ui/StatusBadge"
import { useStore } from "../hooks/useStores"
import type { StoreProduct } from "../types/api"

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: store, isLoading, error, refetch } = useStore(id ?? "")
  const [showAdd, setShowAdd] = useState(false)
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null)

  if (isLoading) return <LoadingSpinner className="py-20" />
  if (error) return <ErrorDisplay error={error as Error} onRetry={() => refetch()} />
  if (!store) return null

  const products = store.StoreProducts ?? []
  const existingProductIds = new Set(products.map((sp) => sp.product_id))

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to Dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
            <StatusBadge status={store.status} />
          </div>
          {store.location_name && (
            <p className="mt-1 text-sm text-gray-500">{store.location_name}</p>
          )}
          {store.address && <p className="mt-0.5 text-xs text-gray-400">{store.address}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Product
        </button>
      </div>

      <div className="mt-6">
        {products.length > 0 ? (
          <ProductTable products={products} onEdit={setEditingProduct} />
        ) : (
          <EmptyState
            title="No products"
            description="Add products to this store to start selling."
            action={
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Add Product
              </button>
            }
          />
        )}
      </div>

      <AddProductModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        storeId={store.id}
        existingProductIds={existingProductIds}
      />
      <EditInventoryModal
        open={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        storeId={store.id}
        storeProduct={editingProduct}
      />
    </div>
  )
}

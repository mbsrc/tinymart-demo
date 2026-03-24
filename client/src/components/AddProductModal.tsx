import { type FormEvent, useState } from "react"
import { useProducts } from "../hooks/useProducts"
import { useAddProduct } from "../hooks/useStores"
import type { Product } from "../types/api"
import { CreateProductForm } from "./CreateProductForm"
import { Modal } from "./ui/Modal"

interface AddProductModalProps {
  open: boolean
  onClose: () => void
  storeId: string
  existingProductIds: Set<string>
}

export function AddProductModal({
  open,
  onClose,
  storeId,
  existingProductIds,
}: AddProductModalProps) {
  const { data: products } = useProducts()
  const addProduct = useAddProduct(storeId)
  const [selectedId, setSelectedId] = useState("")
  const [qty, setQty] = useState(10)
  const [threshold, setThreshold] = useState(5)
  const [showCreate, setShowCreate] = useState(false)

  const availableProducts = products?.filter((p) => !existingProductIds.has(p.id)) ?? []

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedId) return

    addProduct.mutate(
      { product_id: selectedId, quantity_on_hand: qty, low_stock_threshold: threshold },
      {
        onSuccess: () => {
          setSelectedId("")
          setQty(10)
          setThreshold(5)
          onClose()
        },
      },
    )
  }

  function handleProductCreated(product: Product) {
    setSelectedId(product.id)
    setShowCreate(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Product to Store">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="add-product-select" className="block text-sm font-medium text-gray-700">
            Product
          </label>
          <select
            id="add-product-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            required
          >
            <option value="">Select a product...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </select>
        </div>

        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Create new product
          </button>
        ) : (
          <CreateProductForm onCreated={handleProductCreated} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-qty" className="block text-sm font-medium text-gray-700">
              Initial Quantity
            </label>
            <input
              id="add-qty"
              type="number"
              min={0}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="add-threshold" className="block text-sm font-medium text-gray-700">
              Low Stock Threshold
            </label>
            <input
              id="add-threshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
            />
          </div>
        </div>

        {addProduct.error && (
          <p className="text-sm text-red-600">{(addProduct.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={addProduct.isPending || !selectedId}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {addProduct.isPending ? "Adding..." : "Add to Store"}
        </button>
      </form>
    </Modal>
  )
}

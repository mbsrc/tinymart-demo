import { type FormEvent, useEffect, useState } from "react"
import { useUpdateInventory } from "../hooks/useStores"
import type { StoreProduct } from "../types/api"
import { Modal } from "./ui/Modal"

interface EditInventoryModalProps {
  open: boolean
  onClose: () => void
  storeId: string
  storeProduct: StoreProduct | null
}

export function EditInventoryModal({
  open,
  onClose,
  storeId,
  storeProduct,
}: EditInventoryModalProps) {
  const [qty, setQty] = useState(0)
  const [threshold, setThreshold] = useState(5)
  const updateInventory = useUpdateInventory(storeId)

  useEffect(() => {
    if (storeProduct) {
      setQty(storeProduct.quantity_on_hand)
      setThreshold(storeProduct.low_stock_threshold)
    }
  }, [storeProduct])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!storeProduct?.Product) return

    updateInventory.mutate(
      {
        productId: storeProduct.Product.id,
        data: { quantity_on_hand: qty, low_stock_threshold: threshold },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Inventory">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">{storeProduct?.Product?.name}</p>
        <div>
          <label htmlFor="edit-qty" className="block text-sm font-medium text-gray-700">
            Quantity on Hand
          </label>
          <input
            id="edit-qty"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="edit-threshold" className="block text-sm font-medium text-gray-700">
            Low Stock Threshold
          </label>
          <input
            id="edit-threshold"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
        </div>
        {updateInventory.error && (
          <p className="text-sm text-red-600">{(updateInventory.error as Error).message}</p>
        )}
        <button
          type="submit"
          disabled={updateInventory.isPending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {updateInventory.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </Modal>
  )
}

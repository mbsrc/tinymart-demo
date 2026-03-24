import { type FormEvent, useState } from "react"
import { useCreateProduct } from "../hooks/useProducts"
import type { Product } from "../types/api"

interface CreateProductFormProps {
  onCreated: (product: Product) => void
}

export function CreateProductForm({ onCreated }: CreateProductFormProps) {
  const [name, setName] = useState("")
  const [sku, setSku] = useState("")
  const [priceDollars, setPriceDollars] = useState("")
  const [category, setCategory] = useState<"pantry" | "fridge" | "freezer">("fridge")
  const createProduct = useCreateProduct()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const priceCents = Math.round(Number.parseFloat(priceDollars) * 100)
    if (!name.trim() || !sku.trim() || Number.isNaN(priceCents) || priceCents <= 0) return

    createProduct.mutate(
      { name: name.trim(), sku: sku.trim(), price_cents: priceCents, category },
      {
        onSuccess: (product) => {
          setName("")
          setSku("")
          setPriceDollars("")
          onCreated(product)
        },
      },
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4"
    >
      <p className="text-sm font-medium text-gray-700">Create New Product</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          required
        />
        <input
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          required
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={priceDollars}
          onChange={(e) => setPriceDollars(e.target.value)}
          placeholder="Price ($)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          required
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "pantry" | "fridge" | "freezer")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
        >
          <option value="fridge">Fridge</option>
          <option value="pantry">Pantry</option>
          <option value="freezer">Freezer</option>
        </select>
      </div>
      {createProduct.error && (
        <p className="text-sm text-red-600">{(createProduct.error as Error).message}</p>
      )}
      <button
        type="submit"
        disabled={createProduct.isPending}
        className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
      >
        {createProduct.isPending ? "Creating..." : "Create Product"}
      </button>
    </form>
  )
}

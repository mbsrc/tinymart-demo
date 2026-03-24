import type { Product } from "../types/api"
import { apiGet, apiPost } from "./client"

export function listProducts(category?: string) {
  const params = category ? `?category=${category}` : ""
  return apiGet<Product[]>(`/api/products${params}`)
}

export function createProduct(data: {
  name: string
  sku: string
  price_cents: number
  category: "pantry" | "fridge" | "freezer"
  image_url?: string
}) {
  return apiPost<Product>("/api/products", data)
}

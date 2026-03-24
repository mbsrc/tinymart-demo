import type { Store, StoreProduct } from "../types/api"
import { apiGet, apiPatch, apiPost } from "./client"

export function listStores() {
  return apiGet<Store[]>("/api/stores")
}

export function getStore(id: string) {
  return apiGet<Store>(`/api/stores/${id}`)
}

export function createStore(data: { name: string; location_name?: string; address?: string }) {
  return apiPost<Store>("/api/stores", data)
}

export function addProductToStore(
  storeId: string,
  data: { product_id: string; quantity_on_hand?: number; low_stock_threshold?: number },
) {
  return apiPost<StoreProduct>(`/api/stores/${storeId}/products`, data)
}

export function updateStoreProduct(
  storeId: string,
  productId: string,
  data: { quantity_on_hand?: number; low_stock_threshold?: number },
) {
  return apiPatch<StoreProduct>(`/api/stores/${storeId}/products/${productId}`, data)
}

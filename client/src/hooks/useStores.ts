import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  addProductToStore,
  createStore,
  getStore,
  listStores,
  updateStoreProduct,
} from "../api/stores"

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: listStores,
  })
}

export function useStore(id: string) {
  return useQuery({
    queryKey: ["stores", id],
    queryFn: () => getStore(id),
  })
}

export function useCreateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createStore,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  })
}

export function useAddProduct(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      product_id: string
      quantity_on_hand?: number
      low_stock_threshold?: number
    }) => addProductToStore(storeId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores", storeId] }),
  })
}

export function useUpdateInventory(storeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: string
      data: { quantity_on_hand?: number; low_stock_threshold?: number }
    }) => updateStoreProduct(storeId, productId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores", storeId] }),
  })
}

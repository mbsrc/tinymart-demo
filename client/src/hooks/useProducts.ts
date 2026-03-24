import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createProduct, listProducts } from "../api/products"

export function useProducts(category?: string) {
  return useQuery({
    queryKey: ["products", category],
    queryFn: () => listProducts(category),
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  })
}

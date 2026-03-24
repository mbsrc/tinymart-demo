import { useQuery } from "@tanstack/react-query"
import { type TransactionFilters, getTransaction, listTransactions } from "../api/transactions"

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => listTransactions(filters),
  })
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transactions", id],
    queryFn: () => getTransaction(id as string),
    enabled: !!id,
  })
}

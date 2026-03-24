import type { TransactionListResponse } from "../types/api"
import type { TransactionDetail } from "../types/api"
import { apiGet } from "./client"

export interface TransactionFilters {
  store_id?: string
  status?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export function listTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const qs = params.toString()
  return apiGet<TransactionListResponse>(`/api/transactions${qs ? `?${qs}` : ""}`)
}

export function getTransaction(id: string) {
  return apiGet<TransactionDetail>(`/api/transactions/${id}`)
}

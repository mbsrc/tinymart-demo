import type { Session, SessionItem, Transaction } from "../types/api"
import { apiGet, apiPost } from "./client"

export function createSession(data: {
  store_id: string
  stripe_payment_method_id?: string
}) {
  return apiPost<Session>("/api/sessions", data)
}

export function getSession(id: string) {
  return apiGet<Session>(`/api/sessions/${id}`)
}

export function addItem(
  sessionId: string,
  data: { product_id: string; action: "added" | "removed" },
) {
  return apiPost<SessionItem>(`/api/sessions/${sessionId}/items`, data)
}

export function closeSession(sessionId: string) {
  return apiPost<Session>(`/api/sessions/${sessionId}/close`)
}

export function getTransaction(sessionId: string) {
  return apiGet<Transaction>(`/api/sessions/${sessionId}/transaction`)
}

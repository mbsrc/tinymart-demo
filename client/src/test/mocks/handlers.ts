import { http, HttpResponse } from "msw"
import {
  mockClosedSession,
  mockHealth,
  mockProduct1,
  mockProduct2,
  mockSession,
  mockSessionItem,
  mockStore,
  mockStore2,
  mockTransaction,
} from "./data"

const envelope = <T>(data: T) => ({
  success: true,
  data,
  error: null,
  meta: { correlation_id: "test-corr-id", timestamp: new Date().toISOString() },
})

const errorEnvelope = (code: string, message: string) => ({
  success: false,
  data: null,
  error: { code, message },
  meta: { correlation_id: "test-corr-id", timestamp: new Date().toISOString() },
})

let sessionItems = [...(mockSession.SessionItems ?? [])]
let sessionClosed = false

export const handlers = [
  // Stores (authenticated)
  http.get("/api/stores", ({ request }) => {
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey || apiKey === "bad-key")
      return HttpResponse.json(errorEnvelope("UNAUTHORIZED", "Invalid API key"), { status: 401 })
    return HttpResponse.json(envelope([mockStore, mockStore2]))
  }),

  http.get("/api/stores/:id", ({ request, params }) => {
    const apiKey = request.headers.get("x-api-key")
    if (!apiKey || apiKey === "bad-key")
      return HttpResponse.json(errorEnvelope("UNAUTHORIZED", "Invalid API key"), { status: 401 })
    if (params.id === "store-1") return HttpResponse.json(envelope(mockStore))
    if (params.id === "store-2") return HttpResponse.json(envelope(mockStore2))
    return HttpResponse.json(errorEnvelope("STORE_NOT_FOUND", "Store not found"), { status: 404 })
  }),

  http.post("/api/stores", () => {
    return HttpResponse.json(envelope({ ...mockStore, id: "store-new", name: "New Store" }), {
      status: 201,
    })
  }),

  // Products (authenticated)
  http.get("/api/products", () => {
    return HttpResponse.json(envelope([mockProduct1, mockProduct2]))
  }),

  // Kiosk store (public)
  http.get("/api/sessions/store/:storeId", ({ params }) => {
    if (params.storeId === "store-1") return HttpResponse.json(envelope(mockStore))
    return HttpResponse.json(errorEnvelope("STORE_NOT_FOUND", "Store not found"), { status: 404 })
  }),

  // Sessions (public)
  http.post("/api/sessions", () => {
    sessionItems = []
    sessionClosed = false
    return HttpResponse.json(envelope(mockSession), { status: 201 })
  }),

  http.get("/api/sessions/:id", () => {
    if (sessionClosed) {
      return HttpResponse.json(
        envelope({
          ...mockClosedSession,
          SessionItems: sessionItems,
        }),
      )
    }
    return HttpResponse.json(
      envelope({
        ...mockSession,
        SessionItems: sessionItems,
      }),
    )
  }),

  http.post("/api/sessions/:id/items", async ({ request }) => {
    const body = (await request.json()) as { product_id: string; action: "added" | "removed" }
    const newItem = {
      ...mockSessionItem,
      id: `item-${Date.now()}`,
      product_id: body.product_id,
      action: body.action,
    }
    sessionItems.push(newItem)
    return HttpResponse.json(envelope(newItem), { status: 201 })
  }),

  http.post("/api/sessions/:id/close", () => {
    sessionClosed = true
    const now = new Date().toISOString()
    return HttpResponse.json(
      envelope({
        ...mockClosedSession,
        SessionItems: sessionItems,
        Transaction: { ...mockTransaction, total_cents: 199 },
        closed_at: now,
        charged_at: now,
      }),
    )
  }),

  // Health (public)
  http.get("/health/detailed", () => {
    return HttpResponse.json(envelope(mockHealth))
  }),
]

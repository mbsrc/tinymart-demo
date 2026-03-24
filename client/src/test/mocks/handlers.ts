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
  mockStoreProduct1,
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

  // Store products (authenticated)
  http.post("/api/stores/:storeId/products", async ({ request }) => {
    const body = (await request.json()) as {
      product_id: string
      quantity_on_hand?: number
      low_stock_threshold?: number
    }
    const product = body.product_id === "prod-1" ? mockProduct1 : mockProduct2
    return HttpResponse.json(
      envelope({
        ...mockStoreProduct1,
        id: `sp-new-${Date.now()}`,
        product_id: body.product_id,
        quantity_on_hand: body.quantity_on_hand ?? 10,
        low_stock_threshold: body.low_stock_threshold ?? 5,
        Product: product,
      }),
      { status: 201 },
    )
  }),

  http.patch("/api/stores/:storeId/products/:productId", async ({ request }) => {
    const body = (await request.json()) as {
      quantity_on_hand?: number
      low_stock_threshold?: number
    }
    return HttpResponse.json(
      envelope({
        ...mockStoreProduct1,
        quantity_on_hand: body.quantity_on_hand ?? mockStoreProduct1.quantity_on_hand,
        low_stock_threshold: body.low_stock_threshold ?? mockStoreProduct1.low_stock_threshold,
      }),
    )
  }),

  // Products (authenticated)
  http.get("/api/products", () => {
    return HttpResponse.json(envelope([mockProduct1, mockProduct2]))
  }),

  http.post("/api/products", async ({ request }) => {
    const body = (await request.json()) as { name: string; sku: string }
    return HttpResponse.json(
      envelope({
        ...mockProduct1,
        id: `prod-new-${Date.now()}`,
        name: body.name,
        sku: body.sku,
      }),
      { status: 201 },
    )
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
    const product = body.product_id === "prod-1" ? mockProduct1 : mockProduct2
    const newItem = {
      ...mockSessionItem,
      id: `item-${Date.now()}`,
      product_id: body.product_id,
      action: body.action,
      Product: product,
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

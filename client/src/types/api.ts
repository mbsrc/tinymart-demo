// Response envelope
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: { code: string; message: string; retry_after?: number } | null
  meta: {
    correlation_id: string
    timestamp: string
  }
}

// Status unions
export type StoreStatus = "online" | "offline" | "maintenance"
export type ProductCategory = "pantry" | "fridge" | "freezer"
export type SessionStatus = "open" | "closed" | "charged" | "failed"
export type TransactionStatus = "pending" | "succeeded" | "failed" | "refunded"
export type ItemAction = "added" | "removed"

// Entities
export interface Store {
  id: string
  operator_id: string
  name: string
  location_name: string | null
  address: string | null
  status: StoreStatus
  created_at: string
  updated_at: string
  StoreProducts?: StoreProduct[]
}

export interface Product {
  id: string
  operator_id: string
  name: string
  sku: string
  price_cents: number
  image_url: string | null
  category: ProductCategory
  created_at: string
  updated_at: string
}

export interface StoreProduct {
  id: string
  store_id: string
  product_id: string
  quantity_on_hand: number
  low_stock_threshold: number
  version: number
  created_at: string
  updated_at: string
  Product?: Product
}

export interface Session {
  id: string
  store_id: string
  stripe_customer_id: string | null
  stripe_payment_intent_id: string | null
  idempotency_key: string | null
  status: SessionStatus
  opened_at: string
  closed_at: string | null
  charged_at: string | null
  created_at: string
  updated_at: string
  SessionItems?: SessionItem[]
  Transaction?: Transaction
}

export interface SessionItem {
  id: string
  session_id: string
  product_id: string
  action: ItemAction
  timestamp: string
  created_at: string
  updated_at: string
  Product?: Product
}

export interface Transaction {
  id: string
  session_id: string
  store_id: string
  total_cents: number
  stripe_charge_id: string | null
  idempotency_key: string | null
  status: TransactionStatus
  created_at: string
  updated_at: string
  Store?: { id: string; name: string; location_name?: string | null }
}

export interface TransactionDetail extends Transaction {
  Session?: Session
}

export interface TransactionListResponse {
  transactions: Transaction[]
  total: number
  limit: number
  offset: number
}

// Health types
export interface HealthCheck {
  status: "ok"
}

export interface ReadinessCheck {
  status: "ready" | "degraded" | "unavailable"
  checks: Record<string, DependencyStatus>
}

export interface DependencyStatus {
  status: "healthy" | "degraded" | "unhealthy"
  latency_ms?: number
}

export interface CircuitBreakerInfo {
  state: "closed" | "open" | "half_open"
  failure_count: number
}

export interface DetailedHealth {
  status: "healthy" | "degraded"
  dependencies: Record<string, DependencyStatus>
  circuit_breakers: Record<string, CircuitBreakerInfo>
  job_queue: Record<string, unknown>
  uptime: number
  memory: {
    rss: number
    heap_used: number
    heap_total: number
  }
}

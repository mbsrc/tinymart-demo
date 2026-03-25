import type {
  DetailedHealth,
  Product,
  Session,
  SessionItem,
  Store,
  StoreProduct,
  Transaction,
} from "../../types/api"

const now = new Date().toISOString()

export const mockProduct1: Product = {
  id: "prod-1",
  operator_id: "op-1",
  name: "Bottled Water",
  sku: "WAT-001",
  price_cents: 199,
  image_url: null,
  category: "fridge",
  created_at: now,
  updated_at: now,
}

export const mockProduct2: Product = {
  id: "prod-2",
  operator_id: "op-1",
  name: "Energy Bar",
  sku: "BAR-001",
  price_cents: 299,
  image_url: null,
  category: "pantry",
  created_at: now,
  updated_at: now,
}

export const mockStoreProduct1: StoreProduct = {
  id: "sp-1",
  store_id: "store-1",
  product_id: "prod-1",
  quantity_on_hand: 15,
  low_stock_threshold: 3,
  version: 1,
  created_at: now,
  updated_at: now,
  Product: mockProduct1,
}

export const mockStoreProduct2: StoreProduct = {
  id: "sp-2",
  store_id: "store-1",
  product_id: "prod-2",
  quantity_on_hand: 2,
  low_stock_threshold: 5,
  version: 1,
  created_at: now,
  updated_at: now,
  Product: mockProduct2,
}

export const mockStore: Store = {
  id: "store-1",
  operator_id: "op-1",
  name: "Downtown Fridge",
  location_name: "Urban convenience",
  address: "123 Main St",
  status: "online",
  created_at: now,
  updated_at: now,
  StoreProducts: [mockStoreProduct1, mockStoreProduct2],
}

export const mockStore2: Store = {
  id: "store-2",
  operator_id: "op-1",
  name: "Campus Market",
  location_name: "University location",
  address: "456 College Ave",
  status: "online",
  created_at: now,
  updated_at: now,
  StoreProducts: [],
}

export const mockSession: Session = {
  id: "session-1",
  store_id: "store-1",
  stripe_payment_method_id: null,
  stripe_payment_intent_id: null,
  idempotency_key: null,
  status: "open",
  opened_at: now,
  closed_at: null,
  charged_at: null,
  created_at: now,
  updated_at: now,
  SessionItems: [],
}

export const mockSessionItem: SessionItem = {
  id: "item-1",
  session_id: "session-1",
  product_id: "prod-1",
  action: "added",
  timestamp: now,
  created_at: now,
  updated_at: now,
  Product: mockProduct1,
}

export const mockTransaction: Transaction = {
  id: "txn-1",
  session_id: "session-1",
  store_id: "store-1",
  total_cents: 199,
  stripe_charge_id: "ch_test_123",
  idempotency_key: null,
  status: "succeeded",
  created_at: now,
  updated_at: now,
}

export const mockClosedSession: Session = {
  ...mockSession,
  status: "charged",
  closed_at: now,
  charged_at: now,
  SessionItems: [mockSessionItem],
  Transaction: mockTransaction,
}

export const mockHealth: DetailedHealth = {
  status: "healthy",
  dependencies: {
    database: { status: "healthy", latency_ms: 2 },
    stripe: { status: "healthy" },
    job_queue: { status: "healthy" },
  },
  circuit_breakers: {
    stripe: { state: "closed", failure_count: 0 },
  },
  job_queue: {},
  uptime: 3600,
  memory: { rss: 94781440, heap_used: 30929536, heap_total: 33521664 },
}

# Plan 21: Frontend UI

## Context

TinyMart's backend is complete — all V1 features, V2 reliability hardening, e2e tests, and Heroku deployment are done. The PRD specifies a React frontend with three modules (operator dashboard, shopper kiosk, system health) but no frontend code exists yet. This plan builds a polished, interview-ready UI that showcases the full shopping lifecycle and backend reliability features.

**Branch:** `develop` (or `feature/frontend-ui`)

## Architecture Decisions

- **Directory:** `client/` at project root — clean separation from backend `src/`
- **Stack:** Vite + React 19 + TypeScript + Tailwind CSS 4 (locked in PRD)
- **State:** TanStack React Query for server state, React context for auth
- **Routing:** React Router v7 — `/` dashboard, `/stores/:id` detail, `/kiosk/:storeId` kiosk, `/health` status
- **Dev mode:** Vite on `:5173` proxies `/api/*` and `/health*` to backend on `:3001`, coordinated via `concurrently`
- **Production:** `vite build` outputs to `dist/client/`, Express serves via `express.static()` + SPA catch-all
- **Auth:** Operator pastes API key into a prompt, stored in localStorage. Kiosk/health pages are public (no key needed)
- **No Stripe Elements** — card entry is skipped for this demo (test mode, `chargeOrDefer` handles it server-side)

## Sub-steps

### 21a. Scaffold Vite + React + Tailwind

Create `client/` with all build tooling. Wire up dev proxy and root-level script coordination.

**Create:**
- `client/index.html` — Vite entry HTML with `<div id="root">`
- `client/tsconfig.json` — Browser TS config (`jsx: react-jsx`, `module: ESNext`, `target: ES2022`)
- `client/vite.config.ts` — Proxy `/api` and `/health` to `:3001`, output to `../dist/client`
- `client/postcss.config.js` — PostCSS with Tailwind
- `client/src/main.tsx` — React entry point
- `client/src/App.tsx` — Placeholder with "TinyMart" text
- `client/src/index.css` — Tailwind `@import` directives

**Modify:**
- `package.json` — Add dependencies (`react`, `react-dom`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `postcss`, `autoprefixer`, `react-router-dom`, `@tanstack/react-query`, `concurrently`), update scripts:
  - `dev` → `concurrently -n api,ui "tsx watch src/server.ts" "cd client && bunx vite"`
  - `dev:api` → `tsx watch src/server.ts` (keep original)
  - `build` → `tsc && cd client && bunx vite build`
- `biome.json` — Already includes all files outside `node_modules/dist` — no change needed

**Verify:** `bun run dev` starts both servers. `localhost:5173` shows placeholder. `localhost:5173/health` proxies to backend.

---

### 21b. API client, shared types, and auth context

Build the data layer that all pages depend on.

**Create:**
- `client/src/types/api.ts` — Frontend types mirroring backend models:
  - `ApiResponse<T>`, `Store`, `Product`, `StoreProduct`, `Session`, `SessionItem`, `Transaction`
  - `DetailedHealth`, `DependencyStatus`, `CircuitBreakerInfo`
  - Status union types: `StoreStatus`, `ProductCategory`, `SessionStatus`, `TransactionStatus`
- `client/src/api/client.ts` — Fetch wrapper:
  - `apiGet<T>(path)`, `apiPost<T>(path, body)`, `apiPatch<T>(path, body)`
  - Auto-adds `Idempotency-Key: crypto.randomUUID()` to mutations
  - Reads API key from module state, adds `x-api-key` header when present
  - Unwraps envelope, throws on `success: false`
- `client/src/api/stores.ts` — `listStores`, `getStore`, `createStore`, `addProductToStore`, `updateStoreProduct`
- `client/src/api/products.ts` — `listProducts`, `createProduct`
- `client/src/api/sessions.ts` — `createSession`, `getSession`, `addItem`, `closeSession`, `getTransaction`
- `client/src/api/health.ts` — `getHealth`, `getReadiness`, `getDetailedHealth`
- `client/src/contexts/AuthContext.tsx` — React context with `apiKey`, `setApiKey`, `clearApiKey`. Persists to localStorage. Exports `useAuth` hook
- `client/src/hooks/useStores.ts` — React Query hooks: `useStores()`, `useStore(id)`, `useCreateStore()`, `useAddProduct()`, `useUpdateInventory()`
- `client/src/hooks/useProducts.ts` — `useProducts()`, `useCreateProduct()`
- `client/src/hooks/useSession.ts` — `useCreateSession()`, `useSession(id)`, `useAddItem()`, `useCloseSession()`
- `client/src/hooks/useHealth.ts` — `useDetailedHealth()` with `refetchInterval: 10_000`

**Verify:** TypeScript compiles. Hooks can be imported without errors.

---

### 21c. Layout, navigation, and routing

Build the app shell and page skeletons.

**Create:**
- `client/src/components/Layout.tsx` — Sidebar nav with links: Dashboard, Health. Shows API key status indicator. "Open Kiosk" dropdown linking to each store's kiosk. Responsive — sidebar collapses on mobile
- `client/src/components/ApiKeyPrompt.tsx` — Modal that appears when no API key is set. Input + "Connect" button. Validates by calling `GET /api/stores` — shows error on 401
- `client/src/components/ui/StatusBadge.tsx` — Colored badge component (green/yellow/red/gray) for store status, health status, transaction status
- `client/src/components/ui/ErrorDisplay.tsx` — Error state with code, message, correlation ID, retry button
- `client/src/components/ui/LoadingSpinner.tsx` — Spinner/skeleton component
- `client/src/components/ui/EmptyState.tsx` — Empty state with icon, title, description, CTA button
- `client/src/components/ui/Modal.tsx` — Reusable modal wrapper (overlay + centered panel + close button)
- `client/src/pages/DashboardPage.tsx` — Placeholder
- `client/src/pages/StoreDetailPage.tsx` — Placeholder
- `client/src/pages/KioskPage.tsx` — Placeholder
- `client/src/pages/HealthPage.tsx` — Placeholder
- `client/src/utils/format.ts` — `formatCents(cents) → "$1.99"`, `formatDate(iso) → readable string`

**Modify:**
- `client/src/App.tsx` — Set up `BrowserRouter`, `QueryClientProvider`, `AuthProvider`. Dashboard/health routes wrapped in `Layout`. Kiosk route gets its own full-screen layout (no sidebar)

**Verify:** Navigate between routes. API key prompt appears. Enter key, see "Connected" indicator. Sidebar links work.

---

### 21d. Dashboard — store list

**Create/modify:**
- `client/src/pages/DashboardPage.tsx` — Grid of store cards from `useStores()`. Each shows name, location, status badge, product count. Links to `/stores/:id`. "New Store" button opens create modal
- `client/src/components/StoreCard.tsx` — Card component: name, location, address, status badge
- `client/src/components/CreateStoreModal.tsx` — Form: name (required), location_name, address. Calls `useCreateStore()` mutation, invalidates cache on success

**Verify:** With seeded data, see 2 store cards. Create a new store, see it appear.

---

### 21e. Dashboard — store detail + inventory management

**Create/modify:**
- `client/src/pages/StoreDetailPage.tsx` — Store header (name, location, status), product table with inventory data, "Add Product" and "Edit" actions
- `client/src/components/ProductTable.tsx` — Table: Name, SKU, Category, Price, Qty on Hand, Threshold, Stock Status (red warning if qty ≤ threshold). Row-level edit button
- `client/src/components/AddProductModal.tsx` — Select from existing products (from `useProducts()`), set initial qty and threshold. Option to create new product inline
- `client/src/components/EditInventoryModal.tsx` — Update `quantity_on_hand` and `low_stock_threshold` for a store product
- `client/src/components/CreateProductForm.tsx` — Form: name, SKU, price (dollars input → cents), category dropdown, image_url

**Verify:** Navigate to store detail. See 10 products with quantities. Low-stock items show warning. Add product, update inventory — changes reflect immediately.

---

### 21f. Shopper kiosk — full shopping flow

Full-screen kiosk experience with state machine: tap → shop → close → receipt.

**Create:**
- `client/src/pages/KioskPage.tsx` — State machine controller. Fetches store info on mount. Phases: `idle` → `shopping` → `closing` → `receipt`
- `client/src/components/kiosk/TapToStart.tsx` — Store name, large animated "Tap to Start" button. Calls `createSession`
- `client/src/components/kiosk/ProductGrid.tsx` — Grid of product cards. Each shows name, price, category icon/color. "Add to cart" button. Products with 0 stock are grayed out
- `client/src/components/kiosk/CartSidebar.tsx` — Right sidebar showing cart items, quantities, running total. Each item has +/− buttons. "Close Door" CTA at bottom. Uses client-side reconciliation for optimistic display
- `client/src/components/kiosk/Receipt.tsx` — Receipt card: store name, date, itemized list (name × qty = subtotal), total, transaction status badge, session ID. "New Session" button to restart
- `client/src/utils/reconcileCart.ts` — Client-side reconciliation (mirrors backend `src/utils/reconcileCart.ts`). Derives net quantities from session items for optimistic cart display

**Design:**
- Full viewport, no sidebar nav — kiosk feels like a standalone app
- Large touch targets (48px min), big text, clear visual hierarchy
- Product cards use category colors: fridge=blue, pantry=amber, freezer=purple
- Cart total updates optimistically before server confirms
- "Back to Dashboard" link in corner for demo navigation

**Verify:** Navigate to `/kiosk/<store-id>`. Tap to start. Add items, see running total. Remove item. Close door. Receipt shows correct total. Start new session.

---

### 21g. System health page

**Create:**
- `client/src/pages/HealthPage.tsx` — Overall status banner (healthy/degraded), dependency cards, circuit breaker panel, system metrics. Auto-refreshes every 10s
- `client/src/components/health/DependencyCard.tsx` — Card: dependency name, status indicator (green/yellow/red), latency (for DB)
- `client/src/components/health/CircuitBreakerPanel.tsx` — Stripe circuit state (closed/open/half_open), failure count
- `client/src/components/health/SystemMetrics.tsx` — Uptime (formatted), memory (RSS/heap in MB), dead letter count

**Verify:** Visit `/health`. See green indicators. Auto-refresh updates timestamps.

---

### 21h. Production build + Express static serving

Wire up the production build pipeline.

**Modify:**
- `src/app.ts` — After API routes, before 404 handler, add (production only):
  ```
  if (config.nodeEnv === "production") {
    app.use(express.static(path.join(import.meta.dirname, "client")))
    // SPA catch-all for client-side routing
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next()
      res.sendFile(path.join(import.meta.dirname, "client", "index.html"))
    })
  }
  ```
- `client/vite.config.ts` — Confirm `build.outDir: "../dist/client"`
- `Procfile` — No change (still `web: node dist/server.js`)

**Verify:** `bun run build && bun run start`. Visit `localhost:3001` — see frontend. Navigate to `/stores/xyz`, refresh — SPA loads (not 404).

---

### 21i. Seed data polish for demo

Make the demo experience seamless for interviewers.

**Modify:**
- `src/seeders/20260323000001-demo-data.ts`:
  - Change `api_key: uuid()` → `api_key: "tinymart-demo-key-2026"` (deterministic for README)
  - Add emoji-based product names or placeholder `image_url` values for visual richness
- `README.md` — Update Quick Start with: frontend URL (`localhost:5173`), demo API key (`tinymart-demo-key-2026`), kiosk URL pattern (`/kiosk/<store-id>`), screenshots section placeholder
- `.env.example` — Already has `CORS_ALLOWED_ORIGINS=http://localhost:5173` — no change needed

**Verify:** `bun run db:seed`, enter `tinymart-demo-key-2026` in API key prompt — dashboard loads with 2 stores and 10 products.

---

### 21j. Polish pass

Final sweep for interview-readiness.

- Loading skeletons on store list and detail pages (not just spinners)
- Error boundaries with retry buttons
- Page `<title>` updates per route
- Favicon (simple shopping cart or fridge icon)
- Kiosk transitions (CSS animations via Tailwind `transition-*` classes)
- Responsive: dashboard works on desktop + tablet, kiosk assumes desktop/tablet
- Form validation feedback (inline errors, disabled submit while loading)
- React Query DevTools in dev mode

**Verify:** Full walkthrough: enter key → see stores → view detail → manage inventory → open kiosk → shop → close → receipt → check health page. Everything loads smoothly, errors handled gracefully.

---

## Key Files

| File | Action |
|------|--------|
| `package.json` | Add React/Vite/Tailwind deps, update scripts |
| `client/` (new directory) | Entire frontend |
| `src/app.ts` | Add static serving + SPA catch-all (production) |
| `src/seeders/20260323000001-demo-data.ts` | Deterministic API key |
| `client/vite.config.ts` | Dev proxy, build output |
| `README.md` | Frontend setup instructions |

## Reusable Patterns

- **Response envelope unwrapping:** `client/src/api/client.ts` handles `{ success, data, error }` once — all hooks get clean data
- **Idempotency keys:** Auto-generated in `apiPost`/`apiPatch` — no per-call boilerplate
- **Cart reconciliation:** Client-side `reconcileCart` mirrors `src/utils/reconcileCart.ts` — same algorithm for optimistic UI
- **Status badges:** Single `StatusBadge` component reused across stores, health, transactions

## Verification

After all steps:
1. `bun run dev` — both servers start, frontend proxies to backend
2. `bun run build && bun run start` — production mode serves everything from `:3001`
3. `bun run test` — existing 221 backend tests still pass (frontend doesn't affect them)
4. `bun run typecheck` — both backend and client TypeScript compile
5. `bun run lint` — Biome passes on all files including client
6. Full demo walkthrough: seed → key → dashboard → store detail → kiosk → receipt → health

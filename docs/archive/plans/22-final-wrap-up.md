# Plan 22: Final Wrap-Up

## Goal
Close all gaps between the PRD and implementation before sharing with the Micromart team.

## Audit Findings

All Phase 1 (V1), Phase 2 (V2), and most Phase 3 (Polish) work is complete and solid.
Four gaps remain:

| # | Gap | PRD Ref | Severity |
|---|-----|---------|----------|
| 1 | Transaction History API missing | F3 | Critical |
| 2 | Transaction History frontend page missing | F3 | Critical |
| 3 | Stripe Elements card entry in kiosk flow | F2 | Medium |
| 4 | README test count outdated (says 126, actual 351+) | Polish | Low |

---

## Steps

### Step 1: Transaction History API (backend)
**Files:** `src/routes/transactions.ts` (new), `src/app.ts`

Implement two endpoints per PRD F3:

- `GET /api/transactions` — List transactions for the authenticated operator
  - Filters: `store_id`, `status`, `from`/`to` date range
  - Pagination: `limit` + `offset`
  - Include: store name, session_id
  - Auth: require operator API key (same middleware as stores)

- `GET /api/transactions/:id` — Transaction detail with itemized receipt
  - Include: session items (product name, price, quantity), store info
  - Auth: operator must own the transaction's store

Wire into `src/app.ts` alongside existing API routes.

### Step 2: Transaction History frontend page
**Files:** `client/src/pages/TransactionsPage.tsx` (new), `client/src/api/transactions.ts` (new), `client/src/hooks/useTransactions.ts` (new), `client/src/App.tsx`, `client/src/components/Layout.tsx`

- Transaction list page at `/transactions` route
  - Table with columns: date, store, total, status badge, session ID
  - Filter controls: store dropdown, status dropdown, date range
  - Click row → expand or navigate to detail view
- Transaction detail — itemized receipt with product names, quantities, line totals
- Add "Transactions" link to sidebar navigation (between Dashboard and Health)

### Step 3: Stripe Elements card entry in kiosk
**Files:** `client/src/components/kiosk/CardEntry.tsx` (new), `client/src/pages/KioskPage.tsx`

Add a card collection step between "Tap to Start" and the product grid:

- New kiosk phase: `idle` → `card_entry` → `shopping` → `closing` → `receipt`
- Use Stripe.js `@stripe/stripe-js` + `@stripe/react-stripe-js` packages
- Show a card input form using Stripe Elements (CardElement)
- On submit: create a PaymentMethod, then call POST /api/sessions with the payment_method_id
- Handle card validation errors inline
- "Back" button to return to idle
- Note: requires `VITE_STRIPE_PUBLISHABLE_KEY` env var for the frontend

### Step 4: Update README test counts
**File:** `README.md`

- Update the test count to reflect current numbers (221 backend + 130 frontend + E2E)
- Verify all other README content is still accurate

### Step 5: Final smoke test
- Run `bun run lint` — confirm clean
- Run `bun run test` — all backend tests pass
- Run `bun run test:ui` — all frontend tests pass
- Run `bun run build` — compiles successfully
- Manual walkthrough: dashboard → create store → kiosk flow → transaction history

---

## Execution Order

Steps 1→2 are sequential (frontend needs the API).
Step 3 is independent (can be done in parallel with 1–2).
Step 4 is a quick fix, do last.
Step 5 is the final verification.

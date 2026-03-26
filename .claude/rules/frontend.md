---
paths:
  - "client/src/**/*.{ts,tsx}"
  - "e2e/**/*.ts"
---

# Frontend Rules

## File Structure
`client/src/pages/`, `client/src/components/`, `client/src/hooks/`, `client/src/api/`

## Component Testing (Vitest + jsdom + MSW)
- Run: `bun run test:client` (full) or `cd client && bunx vitest run src/<path>.test.tsx` (single)
- Use `renderWithProviders` from `client/src/test/render.tsx` — never bare `render`
- Use `data-testid` selectors; prefer `findBy*` (async) over `getBy*` for API-loaded content
- MSW handlers in `client/src/test/mocks/handlers.ts`, data in `mocks/data.ts`
- Reset MSW handlers in `afterEach` if you override them

## Playwright E2E (`e2e/`)
- Run: `bun run test:pw`
- Ports: API 3002, Vite 5174, DB `tinymart_e2e` on 5432
- Global setup: `e2e/seed.ts` syncs schema and seeds data
- Fixtures in `e2e/fixtures.ts`, auth helper in `e2e/helpers/auth.ts`
- Tests are sequential (`fullyParallel: false`, `workers: 1`)

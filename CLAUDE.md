# Project: TinyMart
A miniature smart store platform simulating the full shopping lifecycle:
tap card → open fridge → grab items → close door → get charged.
Backend-reliability demo targeting Micromart engineering interviewers.

## Run Commands
- Dev Server: `bun run dev`
- Build: `bun run build`
- Start: `bun run start`
- Test: `bun run test` / `bun run test:watch`
- Lint/Format: `bun run lint`
- DB Setup: `bun run db:up` (Docker)
- Migrations: `bun run db:migrate` / `bun run db:migrate:undo` / `bun run db:seed`

## Tech Stack (locked — ask before making changes)
- Runtime: Node.js 22 + TypeScript (strict mode)
- Framework: Express.js (mirrors Micromart's actual stack)
- Database: PostgreSQL with Sequelize V6 ORM
- Payments: Stripe (test mode)
- Package Manager: bun
- Linting & Formatting: Biome
- Testing: Vitest + Supertest
- Logging: BetterStack (Logtail)
- Deployment: Heroku
- Local Development: Docker + docker-compose.yml
- Frontend: React 19, Vite, TanStack Query, React Router v7, Tailwind v4
- Frontend Testing: Playwright (E2E), Testing Library (component)

## Code Conventions
- No semicolons, 2-space indentation
- No `any` types — strict TypeScript throughout
- Error types must be explicitly defined, not generic Error throws
- NEVER hardcode secrets, API keys, or tokens in source code

## Guidelines
- Prefer incremental steps over doing everything at once.
- If you notice unrelated issues, ask to add them to `docs/todo.md` instead of fixing them on the spot.

## Lessons Learned
- **Biome bans `!` (non-null assertion)** — Use a helper function that throws instead (e.g. `getOperator(req)` in `src/middleware/auth.ts`). Never use `as` to silence the linter when a runtime check is the right fix.
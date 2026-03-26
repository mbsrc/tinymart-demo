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

## Workflow & Process
### Planning
- Backlog is tracked in `docs/todo.md`. Read it at the start of any session.
- Before implementing, outline your plan: list each file you'll change, the approach for each, and any assumptions. Wait for my approval before writing code.
- If you notice unrelated issues while working, add them to `docs/todo.md` instead of fixing them on the spot.

### Git & PR Workflow
- When creating PRs for stacked branches, always verify the base branch is set to the correct parent branch in the stack, not `main`.
- Before running `gh pr create`, confirm the `--base` flag targets the immediate parent branch.

### General Guidelines
- When scaffolding projects or making large changes, present a concise plan first and wait for user approval before executing.
- Prefer incremental steps over doing everything at once.

## Platform Notes
- Use `sed -i '' ...` syntax for macOS (BSD sed). Do not use GNU sed syntax without the empty string argument.

## Lessons Learned
- **Docker PostgreSQL on port 5433** — Remapped from 5432 to avoid conflict with local PostgreSQL. Update `.env`, `tests/setup.ts`, and `docker-compose.yml` together.
- **Sequelize CLI needs CJS** — Project is ESM (`"type": "module"`) but `sequelize-cli` requires CommonJS. Use `tsx node_modules/.bin/sequelize-cli` wrapper and keep `.sequelizerc` + `src/config/sequelize.cjs` as CJS files.
- **Biome bans `!` (non-null assertion)** — Use a helper function that throws instead (e.g. `getOperator(req)` in `src/middleware/auth.ts`). Never use `as` to silence the linter when a runtime check is the right fix.
- **Test parallelism breaks Sequelize sync** — `sequelize.sync({ force: true })` in concurrent test files causes OID errors. Set `fileParallelism: false` in `vitest.config.ts`.
- **Express 4 doesn't catch async errors** — All async route handlers must be wrapped (e.g., using an `asyncHandler` helper) to ensure errors are passed to the global error middleware.

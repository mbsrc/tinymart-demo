  # Project: TinyMart
  A miniature smart store platform simulating the full shopping lifecycle:
  tap card → open fridge → grab items → close door → get charged.
  Backend-reliability demo targeting Micromart engineering interviewers.

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

## Code Conventions
- No semicolons, 2-space indentation
- No `any` types — strict TypeScript throughout
- Error types must be explicitly defined, not generic Error throws
- NEVER hardcode secrets, API keys, or tokens in source code

## Planning
- Save multi-step plans to docs/plans/ before executing to document key decisions
- Progress is tracked in docs/progress.md. Read it at the start of any multi-step task

## Lessons Learned
<!-- Add gotchas and hard-won knowledge here as you discover them -->

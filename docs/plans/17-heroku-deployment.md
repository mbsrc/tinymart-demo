# Plan 17: Heroku Deployment Config

## Goal
Make the app deployable to Heroku with `git push`. Uses the standard Node.js buildpack.

## Issues to fix
1. **Procfile** uses `bun run` — bun is not available on Heroku. Switch to npm/npx.
2. **tsx is a devDependency** — Heroku prunes devDeps before the release phase. Move tsx to dependencies since it's needed for migrations at release time.

## Sub-steps

### 17a. Fix Procfile + move tsx to dependencies
- Update Procfile release command to `npx tsx node_modules/.bin/sequelize-cli db:migrate`
- Move tsx from devDependencies to dependencies in `package.json`

### 17b. Create app.json
- Heroku app manifest with required env vars, addons (heroku-postgresql), and buildpacks

### 17c. Add deployment section to README ✅
- Step-by-step Heroku deployment instructions

---

## Pre-Deploy Fixes

### 17d. Move `sequelize-cli` to production dependencies ✅
- `sequelize-cli` is in `devDependencies` but the Procfile `release` phase and seeding both need it
- Heroku prunes devDeps after build, so migrations will fail without this fix
- **Action**: Move `sequelize-cli` from `devDependencies` to `dependencies` in `package.json`

### 17e. Fix `app.json` — mark `STRIPE_WEBHOOK_SECRET` as optional ✅
- Currently `required: true` but README and `.env.example` say optional
- **Action**: Set `"required": false` in `app.json`

## Deploy Steps (using Heroku MCP)

### 17f. Create Heroku app
- Use Heroku MCP `create_app` to provision the app

### 17g. Add Heroku Postgres addon
- Use Heroku MCP `create_addon` to provision `heroku-postgresql:essential-0`
- `DATABASE_URL` is auto-set by the addon

### 17h. Set config vars
- `NODE_ENV=production`
- `STRIPE_SECRET_KEY=sk_test_...` (user provides)
- `BETTERSTACK_SOURCE_TOKEN=...` (optional)
- `PORT` and `DATABASE_URL` are auto-set by Heroku

### 17i. Deploy code
- Push `develop` branch: `git push heroku develop:main`
- Heroku runs: install → build (`tsc`) → prune devDeps → release (migrations) → start web dyno

### 17j. Seed demo data (first deploy only)
- `heroku run "npx tsx node_modules/.bin/sequelize-cli db:seed:all"`

### 17k. Verify
- `curl https://<app-name>.herokuapp.com/health/detailed | jq`

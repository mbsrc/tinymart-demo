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

### 17c. Add deployment section to README
- Step-by-step Heroku deployment instructions

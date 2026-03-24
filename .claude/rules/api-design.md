# API Development Rules
- All API responses use the envelope: `{ success, data, error, meta }`
- Build responses with `envelope()` / `errorEnvelope()` from `src/utils/envelope.ts`
- Throw `AppError` from `src/types/index.ts` for all operational errors — never raw `Error`

## Express Middleware Order (critical)
1. `helmet` — security headers
2. `trust proxy` — must precede rate limiter
3. `cors` — CORS headers
4. Body parsers (`express.json({ limit: "100kb" })`)
5. `correlationId` — all subsequent middleware depends on it
6. `requestLogger` — logs on res finish to capture status + duration
7. Health routes — before rate limiter so monitors aren't throttled
8. Rate limiter
9. `degradation` — attaches dependency status
10. API routes
11. 404 handler (3-arg)
12. Error handler (4-arg) — always last
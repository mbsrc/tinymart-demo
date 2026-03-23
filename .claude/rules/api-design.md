# API Development Rules
- All API responses follow the envelope: `{ success, data, error, meta }`

## Express Middleware Order (critical)
1. `trust proxy` — must precede rate limiter
2. Body parsers
3. `correlationId` — all subsequent middleware depends on it
4. `requestLogger` — logs on res finish to capture status + duration
5. Health routes — before rate limiter so monitors aren't throttled
6. Rate limiter
7. API routes
8. 404 handler (3-arg)
9. Error handler (4-arg) — always last



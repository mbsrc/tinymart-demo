import express from "express"
import { correlationId } from "./middleware/correlationId.js"
import { errorHandler } from "./middleware/errorHandler.js"
import { notFound } from "./middleware/notFound.js"
import { requestLogger } from "./middleware/requestLogger.js"
import { healthRouter } from "./routes/health.js"

const app = express()

// 1. Trust proxy — must precede rate limiter
app.set("trust proxy", 1)

// 2. Body parsers
app.use(express.json())

// 3. Correlation ID — all subsequent middleware depends on it
app.use(correlationId)

// 4. Request logger — logs on res finish to capture status + duration
app.use(requestLogger)

// 5. Health routes — before rate limiter so monitors aren't throttled
app.use(healthRouter)

// 6. Rate limiter (V2)
// 7. API routes (coming in later phases)

// 8. 404 handler (3-arg)
app.use(notFound)

// 9. Error handler (4-arg) — always last
app.use(errorHandler)

export { app }

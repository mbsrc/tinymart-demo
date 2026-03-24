import cors from "cors"
import express from "express"
import helmet from "helmet"
import { config } from "./config/index.js"
import { authenticateOperator } from "./middleware/auth.js"
import { correlationId } from "./middleware/correlationId.js"
import { degradation } from "./middleware/degradation.js"
import { errorHandler } from "./middleware/errorHandler.js"
import { idempotency } from "./middleware/idempotency.js"
import { notFound } from "./middleware/notFound.js"
import { rateLimiter } from "./middleware/rateLimiter.js"
import { requestLogger } from "./middleware/requestLogger.js"
import { healthRouter } from "./routes/health.js"
import { productsRouter } from "./routes/products.js"
import { storesRouter } from "./routes/stores.js"

const app = express()

// 1. Security headers
app.use(helmet())

// 2. Trust proxy — must precede rate limiter
app.set("trust proxy", 1)

// 3. CORS
app.use(
  cors({
    origin: config.corsAllowedOrigins.includes("*") ? "*" : config.corsAllowedOrigins,
  }),
)

// 4. Body parsers
app.use(express.json({ limit: "100kb" }))

// 5. Correlation ID — all subsequent middleware depends on it
app.use(correlationId)

// 6. Request logger — logs on res finish to capture status + duration
app.use(requestLogger)

// 7. Health routes — before rate limiter so monitors aren't throttled
app.use(healthRouter)

// 8. Rate limiter — after health routes so monitors aren't throttled
app.use(rateLimiter)

// 9. Degradation context — attaches dependency status to each request
app.use(degradation)

// 10. API routes
app.use("/api/stores", authenticateOperator, idempotency, storesRouter)
app.use("/api/products", authenticateOperator, idempotency, productsRouter)

// 11. 404 handler (3-arg)
app.use(notFound)

// 12. Error handler (4-arg) — always last
app.use(errorHandler)

export { app }

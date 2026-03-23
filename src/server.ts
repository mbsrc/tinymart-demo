import { app } from "./app.js"
import { config } from "./config/index.js"
import { logger } from "./utils/logger.js"

app.listen(config.port, () => {
  logger.info(`TinyMart API listening on port ${config.port}`, {
    port: config.port,
    nodeEnv: config.nodeEnv,
  })
})

import { randomUUID } from "node:crypto"
import request from "supertest"
import { app } from "../src/app.js"
import { Operator, sequelize } from "../src/models/index.js"

export { app, request, sequelize }

interface OperatorContext {
  operator: Operator
  headers: Record<string, string>
}

export async function createOperator(name: string): Promise<OperatorContext> {
  const operator = await Operator.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    api_key: `key-${randomUUID()}`,
  })

  return {
    operator,
    headers: {
      "x-api-key": operator.api_key,
      "Content-Type": "application/json",
    },
  }
}

export function idemKey(): Record<string, string> {
  return { "Idempotency-Key": randomUUID() }
}

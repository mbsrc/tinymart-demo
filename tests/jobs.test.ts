import type { Job } from "pg-boss"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { handleCleanupIdempotencyKeys } from "../src/jobs/handlers/cleanupIdempotencyKeys.js"
import { handleSendReceipt, recordJobFailure } from "../src/jobs/handlers/sendReceipt.js"
import type { SendReceiptPayload } from "../src/jobs/handlers/sendReceipt.js"
import {
  IdempotencyKey,
  JobFailure,
  Operator,
  Product,
  Session,
  SessionItem,
  Store,
  StoreProduct,
  Transaction,
  sequelize,
} from "../src/models/index.js"

let storeId: string
let sessionId: string

beforeAll(async () => {
  await sequelize.sync({ force: true })

  const op = await Operator.create({
    name: "Job Test Op",
    email: "jobs@example.com",
    api_key: "test-key-jobs",
  })

  const store = await Store.create({
    operator_id: op.id,
    name: "Job Test Store",
  })
  storeId = store.id

  const product = await Product.create({
    operator_id: op.id,
    name: "Test Item",
    sku: "JOB-001",
    price_cents: 500,
    image_url: null,
    category: "fridge",
  })

  await StoreProduct.create({
    store_id: store.id,
    product_id: product.id,
    quantity_on_hand: 10,
    low_stock_threshold: 2,
  })

  const session = await Session.create({
    store_id: store.id,
    stripe_customer_id: "cus_test",
    stripe_payment_intent_id: "pi_test",
  })
  sessionId = session.id

  await SessionItem.create({
    session_id: session.id,
    product_id: product.id,
    action: "added",
  })
})

afterAll(async () => {
  await sequelize.close()
})

function makeJob<T>(data: T): Job<T>[] {
  return [
    {
      id: "test-job-id",
      name: "test",
      data,
      expireInSeconds: 3600,
      heartbeatSeconds: null,
      signal: new AbortController().signal,
    },
  ]
}

describe("send-receipt handler", () => {
  it("logs receipt for succeeded transaction", async () => {
    const tx = await Transaction.create({
      session_id: sessionId,
      store_id: storeId,
      total_cents: 500,
      stripe_charge_id: "ch_test",
      status: "succeeded",
    })

    const logSpy = vi.spyOn(process.stdout, "write")

    await handleSendReceipt(makeJob<SendReceiptPayload>({ sessionId, transactionId: tx.id }))

    const logs = logSpy.mock.calls.map((c) => c[0] as string)
    const receiptLog = logs.find((l) => l.includes("Receipt sent"))
    expect(receiptLog).toBeDefined()
    expect(receiptLog).toContain(tx.id)

    logSpy.mockRestore()
  })

  it("skips transaction not in succeeded state", async () => {
    const tx = await Transaction.create({
      session_id: sessionId,
      store_id: storeId,
      total_cents: 500,
      stripe_charge_id: null,
      status: "pending",
    })

    const logSpy = vi.spyOn(process.stdout, "write")

    await handleSendReceipt(makeJob<SendReceiptPayload>({ sessionId, transactionId: tx.id }))

    const logs = logSpy.mock.calls.map((c) => c[0] as string)
    const skipLog = logs.find((l) => l.includes("not in succeeded state"))
    expect(skipLog).toBeDefined()

    const receiptLog = logs.find((l) => l.includes("Receipt sent"))
    expect(receiptLog).toBeUndefined()

    logSpy.mockRestore()
  })

  it("skips if transaction not found", async () => {
    const logSpy = vi.spyOn(process.stdout, "write")

    await handleSendReceipt(
      makeJob<SendReceiptPayload>({
        sessionId,
        transactionId: "00000000-0000-0000-0000-000000000000",
      }),
    )

    const logs = logSpy.mock.calls.map((c) => c[0] as string)
    const warnLog = logs.find((l) => l.includes("transaction not found"))
    expect(warnLog).toBeDefined()

    logSpy.mockRestore()
  })
})

describe("recordJobFailure", () => {
  it("writes to job_failures table", async () => {
    await recordJobFailure("test-job", { foo: "bar" }, new Error("boom"), 3)

    const failures = await JobFailure.findAll({ where: { job_name: "test-job" } })
    expect(failures).toHaveLength(1)
    expect(failures[0].error_message).toBe("boom")
    expect(failures[0].attempts).toBe(3)
    expect(failures[0].payload).toEqual({ foo: "bar" })
  })
})

describe("cleanup-expired-idempotency-keys handler", () => {
  it("deletes expired keys", async () => {
    // Create an expired key and a valid key
    await IdempotencyKey.create({
      key: "expired-key-1",
      request_path: "POST /test",
      request_body_hash: "abc123",
      response_status: 200,
      response_body: { success: true },
      expires_at: new Date(Date.now() - 60_000),
    })

    await IdempotencyKey.create({
      key: "valid-key-1",
      request_path: "POST /test",
      request_body_hash: "def456",
      response_status: 200,
      response_body: { success: true },
      expires_at: new Date(Date.now() + 60_000),
    })

    await handleCleanupIdempotencyKeys(makeJob({}))

    const expired = await IdempotencyKey.findByPk("expired-key-1")
    const valid = await IdempotencyKey.findByPk("valid-key-1")

    expect(expired).toBeNull()
    expect(valid).not.toBeNull()
  })
})

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { PendingJob } from "../src/models/PendingJob.js"
import { sequelize } from "../src/models/index.js"

// Mock pg-boss queue before importing safeEnqueue
const mockSend = vi.fn()
vi.mock("../src/jobs/queue.js", () => ({
  getJobQueue: vi.fn(),
}))

import { getJobQueue } from "../src/jobs/queue.js"
import { replayPendingJobs, safeEnqueue } from "../src/jobs/safeEnqueue.js"

const mockedGetJobQueue = vi.mocked(getJobQueue)

beforeAll(async () => {
  await sequelize.sync({ force: true })
})

beforeEach(async () => {
  await PendingJob.destroy({ where: {} })
  vi.clearAllMocks()
})

afterAll(async () => {
  await sequelize.close()
})

describe("safeEnqueue", () => {
  it("enqueues via pg-boss when queue is available", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)
    mockSend.mockResolvedValue("job-id")

    const result = await safeEnqueue("test-queue", { foo: "bar" })

    expect(result.enqueued).toBe("pg-boss")
    expect(mockSend).toHaveBeenCalledWith("test-queue", { foo: "bar" })

    const pending = await PendingJob.count()
    expect(pending).toBe(0)
  })

  it("falls back to pending_jobs when queue is null", async () => {
    mockedGetJobQueue.mockReturnValue(null)

    const result = await safeEnqueue("test-queue", { session_id: "abc" })

    expect(result.enqueued).toBe("pending_jobs")

    const pending = await PendingJob.findAll()
    expect(pending).toHaveLength(1)
    expect(pending[0].queue_name).toBe("test-queue")
    expect(pending[0].payload).toEqual({ session_id: "abc" })
    expect(pending[0].processed_at).toBeNull()
  })

  it("falls back to pending_jobs when pg-boss send throws", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)
    mockSend.mockRejectedValue(new Error("connection lost"))

    const result = await safeEnqueue("test-queue", { data: 1 })

    expect(result.enqueued).toBe("pending_jobs")

    const pending = await PendingJob.count()
    expect(pending).toBe(1)
  })
})

describe("replayPendingJobs", () => {
  it("returns 0 when queue is null", async () => {
    mockedGetJobQueue.mockReturnValue(null)

    const replayed = await replayPendingJobs()
    expect(replayed).toBe(0)
  })

  it("returns 0 when no pending jobs exist", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)

    const replayed = await replayPendingJobs()
    expect(replayed).toBe(0)
  })

  it("replays pending jobs into pg-boss", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)
    mockSend.mockResolvedValue("job-id")

    await PendingJob.create({ queue_name: "q1", payload: { a: 1 }, processed_at: null })
    await PendingJob.create({ queue_name: "q2", payload: { b: 2 }, processed_at: null })

    const replayed = await replayPendingJobs()

    expect(replayed).toBe(2)
    expect(mockSend).toHaveBeenCalledTimes(2)

    const remaining = await PendingJob.findAll({ where: { processed_at: null } })
    expect(remaining).toHaveLength(0)
  })

  it("stops replaying when send fails", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)
    mockSend.mockResolvedValueOnce("ok").mockRejectedValueOnce(new Error("queue down"))

    await PendingJob.create({ queue_name: "q1", payload: { a: 1 }, processed_at: null })
    await PendingJob.create({ queue_name: "q2", payload: { b: 2 }, processed_at: null })

    const replayed = await replayPendingJobs()

    expect(replayed).toBe(1)

    const remaining = await PendingJob.findAll({ where: { processed_at: null } })
    expect(remaining).toHaveLength(1)
    expect(remaining[0].queue_name).toBe("q2")
  })

  it("skips already-processed jobs", async () => {
    mockedGetJobQueue.mockReturnValue({ send: mockSend } as never)
    mockSend.mockResolvedValue("ok")

    await PendingJob.create({ queue_name: "old", payload: {}, processed_at: new Date() })
    await PendingJob.create({ queue_name: "new", payload: {}, processed_at: null })

    const replayed = await replayPendingJobs()

    expect(replayed).toBe(1)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })
})

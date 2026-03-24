import { describe, expect, it } from "vitest"
import { formatCents } from "./format"

describe("formatCents", () => {
  it("formats zero cents", () => {
    expect(formatCents(0)).toBe("$0.00")
  })

  it("formats whole dollars", () => {
    expect(formatCents(100)).toBe("$1.00")
  })

  it("formats cents with padding", () => {
    expect(formatCents(199)).toBe("$1.99")
  })

  it("formats large amounts", () => {
    expect(formatCents(10050)).toBe("$100.50")
  })
})

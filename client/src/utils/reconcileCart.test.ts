import { describe, expect, it } from "vitest"
import type { SessionItem } from "../types/api"
import { reconcileCart } from "./reconcileCart"

const now = new Date().toISOString()

function makeItem(product_id: string, action: "added" | "removed"): SessionItem {
  return {
    id: `item-${Math.random()}`,
    session_id: "session-1",
    product_id,
    action,
    timestamp: now,
    created_at: now,
    updated_at: now,
  }
}

describe("reconcileCart", () => {
  it("returns empty array for empty items", () => {
    expect(reconcileCart([])).toEqual([])
  })

  it("counts added items", () => {
    const items = [
      makeItem("prod-1", "added"),
      makeItem("prod-1", "added"),
      makeItem("prod-2", "added"),
    ]
    const result = reconcileCart(items)
    expect(result).toEqual([
      { product_id: "prod-1", quantity: 2 },
      { product_id: "prod-2", quantity: 1 },
    ])
  })

  it("subtracts removed items", () => {
    const items = [
      makeItem("prod-1", "added"),
      makeItem("prod-1", "added"),
      makeItem("prod-1", "removed"),
    ]
    const result = reconcileCart(items)
    expect(result).toEqual([{ product_id: "prod-1", quantity: 1 }])
  })

  it("excludes products with zero or negative quantity", () => {
    const items = [makeItem("prod-1", "added"), makeItem("prod-1", "removed")]
    expect(reconcileCart(items)).toEqual([])
  })

  it("handles multiple products with mixed actions", () => {
    const items = [
      makeItem("prod-1", "added"),
      makeItem("prod-2", "added"),
      makeItem("prod-1", "added"),
      makeItem("prod-2", "removed"),
      makeItem("prod-1", "removed"),
    ]
    const result = reconcileCart(items)
    expect(result).toEqual([{ product_id: "prod-1", quantity: 1 }])
  })
})

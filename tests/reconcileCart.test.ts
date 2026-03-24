import { describe, expect, it } from "vitest"
import type { SessionItem } from "../src/models/SessionItem.js"
import { reconcileCart } from "../src/utils/reconcileCart.js"

function makeItem(product_id: string, action: "added" | "removed"): SessionItem {
  return { product_id, action } as SessionItem
}

describe("reconcileCart", () => {
  it("counts added items", () => {
    const items = [makeItem("p1", "added"), makeItem("p1", "added"), makeItem("p2", "added")]

    const result = reconcileCart(items)
    expect(result).toEqual([
      { product_id: "p1", quantity: 2 },
      { product_id: "p2", quantity: 1 },
    ])
  })

  it("subtracts removed items", () => {
    const items = [makeItem("p1", "added"), makeItem("p1", "added"), makeItem("p1", "removed")]

    const result = reconcileCart(items)
    expect(result).toEqual([{ product_id: "p1", quantity: 1 }])
  })

  it("excludes products with net zero quantity", () => {
    const items = [makeItem("p1", "added"), makeItem("p1", "removed")]

    const result = reconcileCart(items)
    expect(result).toEqual([])
  })

  it("excludes products with net negative quantity", () => {
    const items = [makeItem("p1", "added"), makeItem("p1", "removed"), makeItem("p1", "removed")]

    const result = reconcileCart(items)
    expect(result).toEqual([])
  })

  it("returns empty array for empty input", () => {
    expect(reconcileCart([])).toEqual([])
  })

  it("handles multiple products with mixed actions", () => {
    const items = [
      makeItem("p1", "added"),
      makeItem("p2", "added"),
      makeItem("p2", "added"),
      makeItem("p1", "removed"),
      makeItem("p3", "added"),
      makeItem("p2", "removed"),
    ]

    const result = reconcileCart(items)
    expect(result).toEqual([
      { product_id: "p2", quantity: 1 },
      { product_id: "p3", quantity: 1 },
    ])
  })
})

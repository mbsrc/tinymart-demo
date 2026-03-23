import { describe, expect, it } from "vitest"
import { reconcileCart } from "../src/utils/reconcileCart.js"

describe("reconcileCart", () => {
  it("single item added", () => {
    const result = reconcileCart([{ product_id: "a", action: "added" }])
    expect(result).toEqual([{ product_id: "a", quantity: 1 }])
  })

  it("item added then removed returns empty", () => {
    const result = reconcileCart([
      { product_id: "a", action: "added" },
      { product_id: "a", action: "removed" },
    ])
    expect(result).toEqual([])
  })

  it("item added twice returns quantity 2", () => {
    const result = reconcileCart([
      { product_id: "a", action: "added" },
      { product_id: "a", action: "added" },
    ])
    expect(result).toEqual([{ product_id: "a", quantity: 2 }])
  })

  it("item added twice removed once returns quantity 1", () => {
    const result = reconcileCart([
      { product_id: "a", action: "added" },
      { product_id: "a", action: "added" },
      { product_id: "a", action: "removed" },
    ])
    expect(result).toEqual([{ product_id: "a", quantity: 1 }])
  })

  it("multiple products", () => {
    const result = reconcileCart([
      { product_id: "a", action: "added" },
      { product_id: "b", action: "added" },
      { product_id: "b", action: "added" },
    ])
    expect(result).toEqual([
      { product_id: "a", quantity: 1 },
      { product_id: "b", quantity: 2 },
    ])
  })

  it("item removed without being added is ignored", () => {
    const result = reconcileCart([{ product_id: "a", action: "removed" }])
    expect(result).toEqual([])
  })

  it("empty input returns empty", () => {
    expect(reconcileCart([])).toEqual([])
  })
})

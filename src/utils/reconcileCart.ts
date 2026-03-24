import type { SessionItem } from "../models/SessionItem.js"

interface CartLine {
  product_id: string
  quantity: number
}

function reconcileCart(items: SessionItem[]): CartLine[] {
  const counts = new Map<string, number>()

  for (const item of items) {
    const current = counts.get(item.product_id) ?? 0
    counts.set(item.product_id, item.action === "added" ? current + 1 : current - 1)
  }

  const lines: CartLine[] = []
  for (const [product_id, quantity] of counts) {
    if (quantity > 0) {
      lines.push({ product_id, quantity })
    }
  }

  return lines
}

export { reconcileCart }
export type { CartLine }

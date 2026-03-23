export interface CartItem {
  product_id: string
  quantity: number
}

interface SessionItemInput {
  product_id: string
  action: "added" | "removed"
}

export function reconcileCart(items: SessionItemInput[]): CartItem[] {
  const counts = new Map<string, number>()

  for (const item of items) {
    const current = counts.get(item.product_id) ?? 0
    counts.set(item.product_id, item.action === "added" ? current + 1 : current - 1)
  }

  const result: CartItem[] = []
  for (const [product_id, quantity] of counts) {
    if (quantity > 0) {
      result.push({ product_id, quantity })
    }
  }
  return result
}

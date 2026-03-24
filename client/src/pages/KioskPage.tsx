import { useCallback, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { CardEntry } from "../components/kiosk/CardEntry"
import { CartSidebar } from "../components/kiosk/CartSidebar"
import { ProductGrid } from "../components/kiosk/ProductGrid"
import { Receipt } from "../components/kiosk/Receipt"
import { TapToStart } from "../components/kiosk/TapToStart"
import { ErrorDisplay } from "../components/ui/ErrorDisplay"
import { LoadingSpinner } from "../components/ui/LoadingSpinner"
import { usePageTitle } from "../hooks/usePageTitle"
import {
  useAddItem,
  useCloseSession,
  useCreateSession,
  useKioskStore,
  useSession,
} from "../hooks/useSession"
import type { Product } from "../types/api"
import { reconcileCart } from "../utils/reconcileCart"

type Phase = "idle" | "card_entry" | "shopping" | "closing" | "receipt"

export default function KioskPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { data: store, isLoading: storeLoading, error: storeError } = useKioskStore(storeId ?? "")
  usePageTitle(store ? `Kiosk — ${store.name}` : "Kiosk")
  const [phase, setPhase] = useState<Phase>("idle")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)

  const createSession = useCreateSession()
  const { data: session } = useSession(sessionId)
  const addItem = useAddItem(sessionId)
  const closeSession = useCloseSession()

  const products = store?.StoreProducts ?? []

  const productMap = useMemo(() => {
    const m = new Map<string, Product>()
    for (const sp of products) {
      if (sp.Product) m.set(sp.Product.id, sp.Product)
    }
    return m
  }, [products])

  const cartLines = useMemo(() => {
    return reconcileCart(session?.SessionItems ?? [])
  }, [session?.SessionItems])

  const handleStart = useCallback(() => {
    setPhase("card_entry")
  }, [])

  const handlePaymentMethod = useCallback(
    (paymentMethodId: string) => {
      if (!storeId) return
      createSession.mutate(
        { store_id: storeId, stripe_payment_method_id: paymentMethodId },
        {
          onSuccess: (data) => {
            setSessionId(data.id)
            setPhase("shopping")
          },
        },
      )
    },
    [storeId, createSession],
  )

  const handleAdd = useCallback(
    (productId: string) => {
      setAddingId(productId)
      addItem.mutate(
        { product_id: productId, action: "added" },
        { onSettled: () => setAddingId(null) },
      )
    },
    [addItem],
  )

  const handleRemove = useCallback(
    (productId: string) => {
      const line = cartLines.find((l) => l.product_id === productId)
      if (!line || line.quantity <= 0) return
      addItem.mutate({ product_id: productId, action: "removed" })
    },
    [addItem, cartLines],
  )

  const handleClose = useCallback(() => {
    if (!sessionId) return
    setPhase("closing")
    setCloseError(null)
    closeSession.mutate(sessionId, {
      onSuccess: () => setPhase("receipt"),
      onError: (err) => {
        setPhase("shopping")
        setCloseError((err as Error).message ?? "Failed to close session. Please try again.")
      },
    })
  }, [sessionId, closeSession])

  const handleNewSession = useCallback(() => {
    setSessionId(null)
    setCloseError(null)
    setPhase("idle")
  }, [])

  if (storeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <LoadingSpinner />
      </div>
    )
  }

  if (storeError || !store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-8">
        <ErrorDisplay error={(storeError as Error) ?? new Error("Store not found")} />
      </div>
    )
  }

  if (phase === "idle") {
    return (
      <div className="relative">
        <TapToStart storeName={store.name} onStart={handleStart} loading={false} />
        <Link
          to="/"
          className="absolute top-4 left-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
        >
          &larr; Dashboard
        </Link>
      </div>
    )
  }

  if (phase === "card_entry") {
    return (
      <div className="relative">
        <CardEntry
          storeName={store.name}
          onPaymentMethod={handlePaymentMethod}
          onBack={() => setPhase("idle")}
          loading={createSession.isPending}
        />
        <Link
          to="/"
          className="absolute top-4 left-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
        >
          &larr; Dashboard
        </Link>
      </div>
    )
  }

  if (phase === "receipt" && session) {
    return (
      <div className="relative">
        <Receipt
          session={session}
          lines={cartLines}
          productMap={productMap}
          storeName={store.name}
          onNewSession={handleNewSession}
        />
        <Link
          to="/"
          className="absolute top-4 left-4 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20"
        >
          &larr; Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{store.name}</h1>
            <p className="text-xs text-gray-500">Pick items from the fridge</p>
          </div>
          <Link
            to="/"
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
          >
            &larr; Dashboard
          </Link>
        </div>
        {closeError && (
          <div className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">
            {closeError}
            <button
              type="button"
              onClick={() => setCloseError(null)}
              className="ml-2 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          <ProductGrid products={products} onAdd={handleAdd} addingId={addingId} />
        </div>
      </div>
      <CartSidebar
        lines={cartLines}
        productMap={productMap}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onClose={handleClose}
        closing={phase === "closing"}
      />
    </div>
  )
}

import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { type FormEvent, useState } from "react"

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

interface CardEntryProps {
  storeName: string
  onPaymentMethod: (paymentMethodId: string) => void
  onBack: () => void
  loading: boolean
}

function CardForm({ storeName, onPaymentMethod, onBack, loading }: CardEntryProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setError(null)
    setSubmitting(true)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError("Card element not found")
      setSubmitting(false)
      return
    }

    const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    })

    if (stripeError) {
      setError(stripeError.message ?? "Card error")
      setSubmitting(false)
      return
    }

    if (paymentMethod) {
      onPaymentMethod(paymentMethod.id)
    }
  }

  const busy = submitting || loading

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{storeName}</h1>
          <p className="mt-1 text-gray-400">Enter your card to start shopping</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-white p-4">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: "16px",
                    color: "#1f2937",
                    "::placeholder": { color: "#9ca3af" },
                  },
                },
              }}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!stripe || busy}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Processing…" : "Start Shopping"}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="w-full text-center text-sm text-gray-400 hover:text-white disabled:opacity-50"
        >
          &larr; Back
        </button>
      </div>
    </div>
  )
}

export function CardEntry(props: CardEntryProps) {
  if (!stripePromise) {
    // No Stripe key configured — skip card entry and proceed directly
    return <SkipCardEntry {...props} />
  }

  return (
    <Elements stripe={stripePromise}>
      <CardForm {...props} />
    </Elements>
  )
}

function SkipCardEntry({ storeName, onPaymentMethod, onBack, loading }: CardEntryProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold text-white">{storeName}</h1>
        <p className="text-gray-400">
          Stripe is not configured. In demo mode, card entry is skipped.
        </p>
        <button
          type="button"
          onClick={() => onPaymentMethod("pm_demo_skip")}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing…" : "Continue to Shopping"}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="w-full text-center text-sm text-gray-400 hover:text-white disabled:opacity-50"
        >
          &larr; Back
        </button>
      </div>
    </div>
  )
}

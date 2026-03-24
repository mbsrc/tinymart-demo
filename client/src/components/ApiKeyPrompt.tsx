import { type FormEvent, useEffect, useRef, useState } from "react"
import { setApiKey as setClientApiKey } from "../api/client"
import { listStores } from "../api/stores"
import { useAuth } from "../contexts/AuthContext"

export function ApiKeyPrompt() {
  const { setApiKey } = useAuth()
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    setError(null)

    // Temporarily set the key to test it
    setClientApiKey(input.trim())
    try {
      await listStores()
      setApiKey(input.trim())
    } catch {
      setError("Invalid API key. Please check and try again.")
      setClientApiKey(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <h2 className="text-xl font-bold text-gray-900">Connect to TinyMart</h2>
        <p className="mt-2 text-sm text-gray-500">
          Enter your operator API key to access the dashboard.
        </p>
        <form onSubmit={handleSubmit} className="mt-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your API key"
            ref={inputRef}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </form>
      </div>
    </div>
  )
}

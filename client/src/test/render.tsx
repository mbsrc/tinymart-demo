import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactElement } from "react"
import { MemoryRouter } from "react-router-dom"
import { setApiKey as setClientApiKey } from "../api/client"
import { AuthProvider } from "../contexts/AuthContext"

interface Options {
  route?: string
  apiKey?: string | null
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  const { route = "/", apiKey = null } = opts

  // Sync both localStorage and the client module before rendering
  if (apiKey) {
    localStorage.setItem("tinymart-api-key", apiKey)
  } else {
    localStorage.removeItem("tinymart-api-key")
  }
  setClientApiKey(apiKey)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { ...result, queryClient }
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ApiKeyPrompt } from "./components/ApiKeyPrompt"
import { Layout } from "./components/Layout"
import { ErrorBoundary } from "./components/ui/ErrorBoundary"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import DashboardPage from "./pages/DashboardPage"
import HealthPage from "./pages/HealthPage"
import KioskPage from "./pages/KioskPage"
import StoreDetailPage from "./pages/StoreDetailPage"
import TransactionsPage from "./pages/TransactionsPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function ProtectedRoutes() {
  const { apiKey } = useAuth()

  if (!apiKey) {
    return (
      <Layout>
        <ApiKeyPrompt />
      </Layout>
    )
  }

  return (
    <Layout>
      <ErrorBoundary key={apiKey}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/stores/:id" element={<StoreDetailPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/health" element={<HealthPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <p className="text-4xl font-bold text-gray-300">404</p>
        <p className="mt-2 text-lg font-semibold text-gray-700">Page not found</p>
        <a
          href="/"
          className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Kiosk is public — no API key needed */}
            <Route
              path="/kiosk/:storeId"
              element={
                <ErrorBoundary>
                  <KioskPage />
                </ErrorBoundary>
              }
            />

            {/* All other routes require API key */}
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Route, Routes } from "react-router-dom"
import { ApiKeyPrompt } from "./components/ApiKeyPrompt"
import { Layout } from "./components/Layout"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import DashboardPage from "./pages/DashboardPage"
import HealthPage from "./pages/HealthPage"
import KioskPage from "./pages/KioskPage"
import StoreDetailPage from "./pages/StoreDetailPage"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function AppRoutes() {
  const { apiKey } = useAuth()

  return (
    <>
      {!apiKey && <ApiKeyPrompt />}
      <Routes>
        {/* Kiosk has its own full-screen layout */}
        <Route path="/kiosk/:storeId" element={<KioskPage />} />

        {/* Dashboard routes with sidebar */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/stores/:id" element={<StoreDetailPage />} />
                <Route path="/health" element={<HealthPage />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

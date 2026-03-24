import { useState } from "react"
import { CreateStoreModal } from "../components/CreateStoreModal"
import { StoreCard } from "../components/StoreCard"
import { EmptyState } from "../components/ui/EmptyState"
import { ErrorDisplay } from "../components/ui/ErrorDisplay"
import { LoadingSpinner } from "../components/ui/LoadingSpinner"
import { useStores } from "../hooks/useStores"

export default function DashboardPage() {
  const { data: stores, isLoading, error, refetch } = useStores()
  const [showCreate, setShowCreate] = useState(false)

  if (isLoading) return <LoadingSpinner className="py-20" />
  if (error) return <ErrorDisplay error={error as Error} onRetry={() => refetch()} />

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your smart stores</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Store
        </button>
      </div>

      {stores && stores.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            title="No stores yet"
            description="Create your first smart store to get started."
            action={
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Create Store
              </button>
            }
          />
        </div>
      )}

      <CreateStoreModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

import { Link } from "react-router-dom"
import type { Store } from "../types/api"
import { StatusBadge } from "./ui/StatusBadge"

export function StoreCard({ store }: { store: Store }) {
  const productCount = store.StoreProducts?.length ?? 0

  return (
    <Link
      to={`/stores/${store.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{store.name}</h3>
        <StatusBadge status={store.status} />
      </div>
      {store.location_name && <p className="mt-1 text-sm text-gray-500">{store.location_name}</p>}
      {store.address && <p className="mt-0.5 text-xs text-gray-400">{store.address}</p>}
      <div className="mt-4 flex items-center gap-1 text-sm text-gray-500">
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        {productCount} {productCount === 1 ? "product" : "products"}
      </div>
    </Link>
  )
}

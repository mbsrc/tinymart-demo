import { useState } from "react"
import type { TransactionFilters } from "../api/transactions"
import { ErrorDisplay } from "../components/ui/ErrorDisplay"
import { LoadingSpinner } from "../components/ui/LoadingSpinner"
import { StatusBadge } from "../components/ui/StatusBadge"
import { usePageTitle } from "../hooks/usePageTitle"
import { useStores } from "../hooks/useStores"
import { useTransaction, useTransactions } from "../hooks/useTransactions"
import type { Transaction } from "../types/api"
import { formatCents, formatDate } from "../utils/format"
import { reconcileCart } from "../utils/reconcileCart"

const PAGE_SIZE = 20

export default function TransactionsPage() {
  usePageTitle("Transactions")
  const [filters, setFilters] = useState<TransactionFilters>({ limit: PAGE_SIZE, offset: 0 })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: stores } = useStores()
  const { data, isLoading, error } = useTransactions(filters)
  const { data: detail, isLoading: detailLoading } = useTransaction(selectedId)

  const transactions = data?.transactions ?? []
  const total = data?.total ?? 0
  const page = Math.floor((filters.offset ?? 0) / PAGE_SIZE)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function updateFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined, offset: 0 }))
  }

  function goToPage(p: number) {
    setFilters((prev) => ({ ...prev, offset: p * PAGE_SIZE }))
  }

  if (error) return <ErrorDisplay error={error as Error} />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          value={filters.store_id ?? ""}
          onChange={(e) => updateFilter("store_id", e.target.value)}
        >
          <option value="">All stores</option>
          {stores?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          value={filters.status ?? ""}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="succeeded">Succeeded</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>

        <input
          type="date"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          value={filters.from ?? ""}
          onChange={(e) => updateFilter("from", e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          value={filters.to ?? ""}
          onChange={(e) => updateFilter("to", e.target.value)}
          aria-label="To date"
        />
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          No transactions found
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Store
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Session
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    selected={selectedId === txn.id}
                    onSelect={() => setSelectedId(selectedId === txn.id ? null : txn.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                {total} transaction{total !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
                  disabled={page === 0}
                  onClick={() => goToPage(page - 1)}
                >
                  Previous
                </button>
                <span className="flex items-center px-2">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
                  disabled={page >= totalPages - 1}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail panel */}
      {selectedId && (
        <TransactionDetailPanel
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

function TransactionRow({
  txn,
  selected,
  onSelect,
}: {
  txn: Transaction
  selected: boolean
  onSelect: () => void
}) {
  return (
    <tr
      className={`cursor-pointer transition-colors hover:bg-gray-50 ${selected ? "bg-blue-50" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect()
      }}
    >
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
        {formatDate(txn.created_at)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
        {txn.Store?.name ?? "—"}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
        {formatCents(txn.total_cents)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <StatusBadge status={txn.status} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs font-mono text-gray-400">
        {txn.session_id.slice(0, 8)}…
      </td>
    </tr>
  )
}

function TransactionDetailPanel({
  detail,
  loading,
  onClose,
}: {
  detail: ReturnType<typeof useTransaction>["data"]
  loading: boolean
  onClose: () => void
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <LoadingSpinner />
      </div>
    )
  }

  if (!detail) return null

  const session = detail.Session
  const items = session?.SessionItems ?? []
  const lines = reconcileCart(items)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Transaction Detail</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Close
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Store</span>
          <p className="font-medium text-gray-900">{detail.Store?.name}</p>
        </div>
        <div>
          <span className="text-gray-500">Status</span>
          <p>
            <StatusBadge status={detail.status} />
          </p>
        </div>
        <div>
          <span className="text-gray-500">Date</span>
          <p className="font-medium text-gray-900">{formatDate(detail.created_at)}</p>
        </div>
        <div>
          <span className="text-gray-500">Total</span>
          <p className="font-medium text-gray-900">{formatCents(detail.total_cents)}</p>
        </div>
      </div>

      {lines.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Items</h3>
          <div className="divide-y divide-gray-100 rounded-md border border-gray-100">
            {lines.map((line) => {
              const product = items.find((i) => i.product_id === line.product_id)?.Product
              return (
                <div
                  key={line.product_id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-gray-900">
                    {product?.name ?? line.product_id}{" "}
                    <span className="text-gray-400">x {line.quantity}</span>
                  </span>
                  <span className="font-medium text-gray-900">
                    {product ? formatCents(product.price_cents * line.quantity) : "—"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

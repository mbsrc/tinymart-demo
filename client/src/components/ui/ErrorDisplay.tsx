interface ErrorDisplayProps {
  error: Error & { code?: string; correlationId?: string }
  onRetry?: () => void
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-lg font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 text-sm text-red-600">{error.message}</p>
      {error.code && <p className="mt-1 text-xs text-red-500">Code: {error.code}</p>}
      {error.correlationId && (
        <p className="mt-1 text-xs text-red-400">Correlation ID: {error.correlationId}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  )
}

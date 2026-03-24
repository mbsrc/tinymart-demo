interface TapToStartProps {
  storeName: string
  onStart: () => void
  loading: boolean
}

export function TapToStart({ storeName, onStart, loading }: TapToStartProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
      <h1 className="mb-2 text-4xl font-bold text-white">{storeName}</h1>
      <p className="mb-12 text-lg text-gray-400">Smart Shopping Experience</p>
      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className="group relative rounded-full bg-blue-600 px-16 py-8 text-2xl font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/40 active:scale-95 disabled:opacity-50"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-20 group-hover:opacity-30" />
        {loading ? "Opening..." : "Tap to Start"}
      </button>
    </div>
  )
}

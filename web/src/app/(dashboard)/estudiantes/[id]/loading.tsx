export default function EstudianteDetalleLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Back button */}
      <div className="h-8 w-24 bg-surface-high rounded-lg" />

      {/* Header card */}
      <div className="rounded-2xl border border-outline-variant p-5 space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-high" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-surface-high rounded" />
            <div className="h-3 w-32 bg-surface-high rounded" />
          </div>
          <div className="h-7 w-20 bg-surface-high rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-surface-high rounded opacity-60" />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[80, 96, 80].map((w, i) => (
          <div key={i} className="h-9 bg-surface-high rounded-lg" style={{ width: w }} />
        ))}
      </div>

      {/* Content blocks */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-outline-variant p-4 space-y-2">
          <div className="h-3.5 w-32 bg-surface-high rounded" />
          <div className="h-3 w-full bg-surface-high rounded opacity-60" />
          <div className="h-3 w-3/4 bg-surface-high rounded opacity-40" />
        </div>
      ))}
    </div>
  )
}

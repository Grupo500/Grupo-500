export default function EstudianteDetalleLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Botón volver */}
      <div className="h-8 w-24 bg-surface-high rounded-lg" />

      {/* Header card */}
      <div className="rounded-2xl border border-outline-variant p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-high flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-5 w-48 bg-surface-high rounded" />
            <div className="h-3 w-32 bg-surface-high rounded opacity-60" />
          </div>
          <div className="h-6 w-20 bg-surface-high rounded-full flex-shrink-0" />
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl bg-surface-high p-3 space-y-1.5">
              <div className="h-3 w-16 bg-surface-highest rounded" />
              <div className="h-5 w-24 bg-surface-highest rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-9 w-24 bg-surface-high rounded-xl" />
        ))}
      </div>

      {/* Content blocks */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-outline-variant p-4 space-y-3">
          <div className="h-3.5 w-32 bg-surface-high rounded" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 w-full bg-surface-high rounded opacity-60" />
            <div className="h-3 w-3/4 bg-surface-high rounded opacity-60" />
            <div className="h-3 w-full bg-surface-high rounded opacity-40" />
            <div className="h-3 w-2/3 bg-surface-high rounded opacity-40" />
          </div>
        </div>
      ))}
    </div>
  )
}

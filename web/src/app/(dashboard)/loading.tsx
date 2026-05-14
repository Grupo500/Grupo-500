export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-surface-high rounded-lg" />
          <div className="h-4 w-24 bg-surface-high rounded-md" />
        </div>
        <div className="h-9 w-32 bg-surface-high rounded-lg" />
      </div>

      {/* Content skeleton */}
      <div className="bg-surface-lowest border border-outline-variant rounded-xl overflow-hidden">
        <div className="border-b border-outline-variant bg-surface-low px-4 py-3 flex gap-6">
          {[120, 80, 100, 90, 110].map((w, i) => (
            <div key={i} className={`h-3 bg-surface-high rounded w-[${w}px]`} />
          ))}
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3.5 border-b border-outline-variant/40 last:border-0">
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-36 bg-surface-high rounded" />
              <div className="h-3 w-24 bg-surface-high rounded opacity-60" />
            </div>
            <div className="h-3.5 w-20 bg-surface-high rounded hidden md:block" />
            <div className="h-5 w-16 bg-surface-high rounded hidden md:block" />
            <div className="h-3.5 w-24 bg-surface-high rounded hidden lg:block" />
            <div className="h-3.5 w-20 bg-surface-high rounded hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

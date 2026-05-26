export default function HospedesLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-5xl">
          <div className="h-7 w-24 bg-muted rounded-lg" />
          <div className="h-9 w-28 bg-muted rounded-lg" />
        </div>
        {/* Search bar */}
        <div className="px-4 lg:px-8 pb-3">
          <div className="h-9 w-full bg-muted rounded-lg max-w-sm" />
        </div>
        {/* Tag filter chips */}
        <div className="flex gap-2 px-4 lg:px-8 pb-3 overflow-hidden">
          {[52, 72, 80, 64, 60].map((w, i) => (
            <div key={i} className="h-6 bg-muted rounded-full shrink-0" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-0 max-w-5xl w-full divide-y divide-border">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="h-4 bg-muted rounded w-2/5" />
              <div className="h-3 bg-muted/60 rounded w-1/3" />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="h-5 w-14 bg-muted rounded-full" />
              <div className="h-3 w-10 bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

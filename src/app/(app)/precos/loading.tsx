export default function PrecosLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 max-w-5xl">
          <div className="h-7 w-24 bg-muted rounded-lg" />
        </div>
        {/* Tabs */}
        <div className="flex gap-0 px-4 lg:px-8 overflow-hidden border-t border-border">
          {[80, 96, 72, 80, 96, 112].map((w, i) => (
            <div
              key={i}
              className="flex items-center h-10 shrink-0 px-1"
              style={{ width: `${w}px` }}
            >
              <div className="h-3.5 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-8 py-5 max-w-5xl w-full">
        {/* Property selector */}
        <div className="flex gap-2">
          {[120, 96, 104].map((w, i) => (
            <div key={i} className="h-8 bg-muted rounded-lg shrink-0" style={{ width: `${w}px` }} />
          ))}
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-2.5 w-24 bg-muted/60 rounded" />
            </div>
          ))}
        </div>

        {/* Rules list */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-8 w-24 bg-muted rounded-lg" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-4 bg-muted rounded w-2/5" />
                  <div className="h-3 bg-muted/60 rounded w-1/3" />
                </div>
                <div className="h-5 w-16 bg-muted rounded-full" />
                <div className="h-8 w-8 bg-muted rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

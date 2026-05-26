export default function RelatoriosLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-5xl">
          <div className="h-7 w-28 bg-muted rounded-lg" />
          <div className="flex gap-2">
            <div className="h-9 w-36 bg-muted rounded-lg" />
            <div className="h-9 w-28 bg-muted rounded-lg" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 lg:px-8 py-5 max-w-5xl w-full">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-2.5 w-14 bg-muted/60 rounded" />
            </div>
          ))}
        </div>

        {/* Main chart area */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-7 w-28 bg-muted rounded-lg" />
          </div>
          {/* Chart bars */}
          <div className="flex items-end gap-2 h-40">
            {[60, 45, 75, 55, 80, 65, 70, 50, 85, 60, 72, 48].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-muted rounded-t"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          {/* X-axis labels */}
          <div className="flex gap-2 mt-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex-1 h-3 bg-muted/60 rounded" />
            ))}
          </div>
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="h-5 w-28 bg-muted rounded" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="h-3 flex-1 bg-muted rounded-full" />
                    <div className="h-3 w-10 bg-muted/60 rounded shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ConciergeLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 max-w-5xl">
          <div className="h-7 w-36 bg-muted rounded-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-8 py-5 max-w-5xl w-full">
        {/* Context selectors */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded-lg" />
            </div>
          ))}
        </div>

        {/* Templates grid */}
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                <div className="h-3.5 w-3/4 bg-muted rounded" />
                <div className="h-3 w-full bg-muted/60 rounded" />
                <div className="h-3 w-2/3 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="h-24 w-full bg-muted rounded-lg" />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-muted rounded-lg" />
              <div className="h-8 w-24 bg-muted rounded-lg" />
            </div>
            <div className="h-9 w-32 bg-muted rounded-lg" />
          </div>
        </div>

        {/* Output area */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-4 w-28 bg-muted rounded" />
          <div className="space-y-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-3 bg-muted/60 rounded"
                style={{ width: `${70 + Math.sin(i) * 20}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

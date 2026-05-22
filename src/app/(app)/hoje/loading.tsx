export default function HojeLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-baseline justify-between gap-2 max-w-5xl">
          <div className="h-7 w-16 bg-muted rounded-lg" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
        {/* Status strip */}
        <div className="flex items-center border-t border-border divide-x divide-border text-sm max-w-5xl overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2.5 shrink-0">
              <div className="h-3.5 w-3.5 bg-muted rounded" />
              <div className="h-4 w-6 bg-muted rounded" />
              <div className="h-3.5 w-14 bg-muted/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0 max-w-5xl w-full">
        {/* Section */}
        <div className="border-b border-border">
          <div className="flex items-center gap-2 px-4 lg:px-8 pt-5 pb-2">
            <div className="h-3.5 w-3.5 bg-muted rounded" />
            <div className="h-3 w-24 bg-muted rounded" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-8 w-1 rounded-full bg-muted shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  <div className="h-4 bg-muted rounded w-2/5" />
                  <div className="h-3 bg-muted/60 rounded w-1/3" />
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <div className="h-3.5 w-16 bg-muted rounded-full" />
                  <div className="h-3 w-10 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div className="px-4 lg:px-8 pt-6 pb-2 grid grid-cols-2 gap-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3.5">
              <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

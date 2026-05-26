export default function WebsiteLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-5xl">
          <div className="h-7 w-28 bg-muted rounded-lg" />
          <div className="h-9 w-28 bg-muted rounded-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 lg:px-8 py-5 max-w-5xl w-full">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-6 w-12 bg-muted rounded" />
            </div>
          ))}
        </div>

        {/* Settings sections */}
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-9 w-full bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* iCal feeds */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-8 w-20 bg-muted rounded-lg" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-7 w-7 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-3.5 w-2/5 bg-muted rounded" />
                  <div className="h-3 w-3/5 bg-muted/60 rounded" />
                </div>
                <div className="h-7 w-7 bg-muted rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

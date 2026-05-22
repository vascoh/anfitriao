export default function AppLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="h-7 w-28 bg-muted rounded-lg" />
          <div className="h-7 w-16 bg-muted rounded-lg" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex flex-col gap-0 max-w-5xl w-full">
        {/* Section header */}
        <div className="px-4 lg:px-8 pt-5 pb-3">
          <div className="h-3 w-24 bg-muted rounded" />
        </div>

        {/* Row skeletons */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3.5 border-b border-border"
          >
            <div className="h-8 w-1 rounded-full bg-muted shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
              <div className="h-4 bg-muted rounded w-3/5" />
              <div className="h-3 bg-muted/60 rounded w-2/5" />
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="h-3.5 w-14 bg-muted rounded-full" />
              <div className="h-3 w-10 bg-muted/60 rounded" />
            </div>
          </div>
        ))}

        {/* Stats strip skeleton */}
        <div className="flex gap-4 px-4 lg:px-8 py-6 border-b border-border">
          {[36, 28, 40].map((w, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 bg-muted/60 rounded" style={{ width: `${w * 2}px` }} />
              <div className="h-6 bg-muted rounded" style={{ width: `${w}px` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

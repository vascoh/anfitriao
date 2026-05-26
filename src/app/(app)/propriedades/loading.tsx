export default function PropriedadesLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-5xl">
          <div className="h-7 w-32 bg-muted rounded-lg" />
          <div className="h-9 w-32 bg-muted rounded-lg" />
        </div>
      </div>

      {/* Property cards */}
      <div className="flex flex-col gap-0 max-w-5xl w-full divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4 px-4 lg:px-8 py-4">
            {/* Color stripe */}
            <div className="h-14 w-1.5 rounded-full bg-muted shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-4 bg-muted rounded w-2/5" />
                <div className="h-5 w-14 bg-muted rounded-full" />
              </div>
              <div className="h-3 bg-muted/60 rounded w-1/3" />
              <div className="flex gap-3">
                <div className="h-3 w-16 bg-muted/60 rounded" />
                <div className="h-3 w-20 bg-muted/60 rounded" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="h-5 w-10 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

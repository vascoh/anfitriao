export default function CalendarioLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 flex items-center justify-between max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-muted rounded-lg" />
            <div className="h-7 w-32 bg-muted rounded-lg" />
            <div className="h-8 w-8 bg-muted rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-20 bg-muted rounded-lg" />
            <div className="h-8 w-20 bg-muted rounded-lg" />
          </div>
        </div>
      </div>

      {/* Calendar grid header (days) */}
      <div className="border-b border-border">
        <div className="flex px-4 lg:px-8 max-w-5xl">
          <div className="w-24 shrink-0 py-2">
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
          <div className="flex-1 grid grid-cols-7 gap-px">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="py-2 flex flex-col items-center gap-1">
                <div className="h-3 w-6 bg-muted rounded" />
                <div className="h-4 w-4 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property rows */}
      <div className="max-w-5xl w-full divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center px-4 lg:px-8 py-3 gap-2">
            <div className="w-24 shrink-0">
              <div className="h-4 bg-muted rounded w-20" />
            </div>
            {/* Timeline bar area */}
            <div className="flex-1 h-8 bg-muted/30 rounded relative overflow-hidden">
              {/* Simulated booking bars */}
              {i % 2 === 0 && (
                <div className="absolute top-1 left-[15%] right-[45%] h-6 bg-muted rounded" />
              )}
              {i % 3 !== 1 && (
                <div className="absolute top-1 left-[60%] right-[10%] h-6 bg-muted/80 rounded" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

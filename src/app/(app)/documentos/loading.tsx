export default function DocumentosLoading() {
  return (
    <div className="flex flex-col min-h-full animate-pulse">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 lg:px-8 py-4 max-w-5xl">
          <div className="h-7 w-32 bg-muted rounded-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 lg:px-8 py-5 max-w-5xl w-full">
        {/* Intro card */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-3 w-full bg-muted/60 rounded" />
          <div className="h-3 w-4/5 bg-muted/60 rounded" />
        </div>

        {/* Upload area */}
        <div className="rounded-xl border-2 border-dashed border-border bg-card p-8 flex flex-col items-center gap-3">
          <div className="h-12 w-12 bg-muted rounded-full" />
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="h-3 w-32 bg-muted/60 rounded" />
          <div className="h-9 w-36 bg-muted rounded-lg mt-2" />
        </div>

        {/* Extracted fields */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="h-4 w-40 bg-muted rounded" />
          </div>
          <div className="p-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-9 w-full bg-muted rounded-lg" />
              </div>
            ))}
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <div className="h-9 w-32 bg-muted rounded-lg" />
            <div className="h-9 w-32 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

import { ArrowLeft } from 'lucide-react'

export default function BookPropertyLoading() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <span className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground">
          <ArrowLeft className="h-5 w-5" />
        </span>
        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
      </header>
      <div className="h-72 bg-muted animate-pulse" />
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-px bg-border" />
        <div className="h-72 bg-muted animate-pulse rounded-xl" />
      </div>
    </div>
  )
}

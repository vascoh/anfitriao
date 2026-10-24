'use client'

import type { Booking } from '@/lib/types'

export function Historico({ historico }: { historico: Booking['historico'] }) {
  return (
    <div className="flex flex-col gap-3 px-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Histórico</h2>
      <div className="flex flex-col gap-0 relative">
        <div className="absolute left-3 top-3 bottom-3 w-px bg-border" />
        {[...historico].reverse().map((ev, i) => (
          <div key={ev.id} className="flex items-start gap-3 pb-4 last:pb-0 relative">
            <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
              i === 0 ? 'border-primary bg-primary' : 'border-border bg-card'
            }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-primary-foreground' : 'bg-muted-foreground/40'}`} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-medium">{ev.descricao}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ev.data))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

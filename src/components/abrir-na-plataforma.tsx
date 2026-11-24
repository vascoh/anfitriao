import { ExternalLink } from 'lucide-react'
import { urlDaReservaNaPlataforma } from '@/lib/ical-referencias'

/**
 * «Abrir no Airbnb» — leva à reserva do lado da plataforma, onde está o nome do
 * hóspede e a conversa. Só aparece quando o feed direto do Airbnb trouxe o
 * código (`referencia_externa`); com o Amenitiz ou o Booking não há código e
 * não se mostra nada.
 */
export function AbrirNaPlataforma({ referencia, className = '' }: { referencia?: string | null; className?: string }) {
  const url = urlDaReservaNaPlataforma(referencia)
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-input px-3 text-xs font-semibold hover:bg-muted transition-colors ${className}`}
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      Abrir no Airbnb
      <span className="font-normal text-muted-foreground tabular-nums">{referencia}</span>
      <span className="sr-only">(abre noutro separador)</span>
    </a>
  )
}

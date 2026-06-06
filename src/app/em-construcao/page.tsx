import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Em breve — Anfitrião',
  description: 'Estamos a preparar algo especial para anfitriões de Alojamento Local em Portugal.',
  robots: { index: false, follow: false },
}

export default function EmConstrucaoPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center px-6 text-center">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
          <svg className="h-5 w-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight">Anfitrião</span>
      </div>

      {/* Badge */}
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        A preparar o lançamento
      </div>

      {/* Headline */}
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl max-w-md leading-tight mb-4">
        Gestão de Alojamento Local,{' '}
        <span className="text-primary">sem stress</span>
      </h1>

      <p className="text-muted-foreground text-base max-w-sm leading-relaxed mb-10">
        Estamos a afinar os últimos detalhes. Em breve podes sincronizar o Airbnb e Booking.com,
        fazer check-in online e gerir todas as tuas reservas num só lugar.
      </p>

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl w-full mb-10 text-left">
        {[
          { icon: '🔄', label: 'Sync Airbnb & Booking', desc: 'Calendários ligados automaticamente' },
          { icon: '📱', label: 'Check-in online', desc: 'SIBA pronto antes da chegada' },
          { icon: '🤖', label: 'Concierge com IA', desc: 'Respostas em 6 idiomas' },
        ].map(f => (
          <div key={f.label} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl mb-2">{f.icon}</div>
            <p className="text-sm font-semibold leading-tight">{f.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs text-muted-foreground">
          Já tens conta?{' '}
          <Link href="/sign-in" className="text-primary font-semibold hover:underline">
            Entrar →
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-xs text-muted-foreground/50">
        © {new Date().getFullYear()} Anfitrião · Feito em Portugal 🇵🇹
      </div>
    </div>
  )
}

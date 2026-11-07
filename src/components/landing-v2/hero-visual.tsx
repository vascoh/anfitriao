import { Check, FileCheck2, LogIn, LogOut } from 'lucide-react'

/**
 * O ecrã «Hoje» em miniatura, que é o primeiro ecrã da app e funciona de
 * raiz no telemóvel. Substitui a ilustração abstrata (nós e órbitas a
 * ciano): mostra o que o produto faz, com dados de exemplo. É decorativo
 * (`aria-hidden`); o texto ao lado diz o mesmo em palavras.
 *
 * HTML e tokens da marca, sem SVG nem cores soltas, para seguir o tema
 * claro/escuro como o resto da página.
 */

const MOVIMENTOS = [
  {
    tipo: 'entrada' as const,
    hora: '15:00',
    nome: 'Ana Ribeiro',
    sitio: 'Loft Ribeira',
    canal: 'Airbnb',
    estado: 'Check-in feito',
  },
  {
    tipo: 'entrada' as const,
    hora: '18:30',
    nome: 'James Carter',
    sitio: 'Casa da Praia',
    canal: 'Booking',
    estado: 'SIBA pronto',
  },
  {
    tipo: 'saida' as const,
    hora: '11:00',
    nome: 'Família Moreau',
    sitio: 'Apartamento Baixa',
    canal: 'Direto',
    estado: 'Limpeza às 12:00',
  },
]

const SEMANA = ['S', 'D', 'S', 'T', 'Q', 'Q', 'S']
const OCUPADO = [true, true, false, true, true, true, false]

export function HeroVisual() {
  return (
    <div aria-hidden className="fade-up relative mx-auto w-full max-w-md" style={{ animationDelay: '200ms' }}>
      <div className="float-lento rounded-[1.75rem] border border-border bg-card p-3 shadow-[0_30px_60px_-30px_rgb(60_30_10/0.35)]">
        <div className="rounded-[1.25rem] border border-border bg-background p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-lg font-semibold tracking-tight text-foreground">Hoje</p>
            <p className="text-xs text-muted-foreground">sábado, 7 nov</p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { n: 2, l: 'entradas' },
              { n: 1, l: 'saída' },
              { n: 0, l: 'por tratar' },
            ].map((k) => (
              <div key={k.l} className="rounded-xl bg-muted px-2 py-2.5">
                <p className="tabular text-xl font-semibold text-foreground">{k.n}</p>
                <p className="text-[11px] text-foreground/75">{k.l}</p>
              </div>
            ))}
          </div>

          <ul className="mt-4 space-y-2">
            {MOVIMENTOS.map((m) => {
              const Icone = m.tipo === 'entrada' ? LogIn : LogOut
              return (
                <li key={m.nome} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                      m.tipo === 'entrada' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icone className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{m.nome}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.hora} · {m.sitio} · {m.canal}
                    </span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-foreground sm:inline-flex">
                    <Check className="size-3 text-primary" />
                    {m.estado}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex items-end justify-between gap-1.5">
            {SEMANA.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className={`h-8 w-full rounded-md ${OCUPADO[i] ? 'bg-primary/70' : 'bg-muted'}`} />
                <span className="text-[10px] text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cartão flutuante: a prova de entrega, que é o argumento central. */}
      <div className="absolute -bottom-6 -left-2 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 shadow-lg sm:-left-8">
        <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
          <FileCheck2 className="size-4" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">Boletim SIBA entregue</span>
          <span className="block text-xs text-muted-foreground">Comprovativo guardado</span>
        </span>
      </div>
    </div>
  )
}

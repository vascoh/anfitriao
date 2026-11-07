import { Calendar, ShieldCheck, Building2 } from 'lucide-react'
import { CONTENTOR, LEAD, SECCAO, TITULO_SECCAO } from './estilos'

const PROPRIEDADES = [
  { nome: 'Apartamento Baixa', ocupacao: 92, estado: 'Ocupado' },
  { nome: 'Casa da Praia', ocupacao: 78, estado: 'Livre' },
  { nome: 'Loft Ribeira', ocupacao: 85, estado: 'Check-in hoje' },
]

/**
 * O painel ilustrado tem de mostrar apenas ecrãs que existem. A versão
 * anterior desta secção mostrava uma caixa de entrada com mensagens do Airbnb
 * e do Booking — funcionalidade que o produto não tem. Foi substituída pela
 * conformidade, que existe (`/conformidade`, `/documentos`).
 */
const CONFORMIDADE = [
  { titulo: 'Boletins do SIBA', detalhe: '2 prontos a entregar', estado: 'aviso' as const },
  { titulo: 'Taxa turística · julho', detalhe: 'Mapa calculado', estado: 'ok' as const },
  { titulo: 'Seguro de responsabilidade civil', detalhe: 'Válido até 14/03/2027', estado: 'ok' as const },
]

const AIRBNB = new Set([4, 5, 6, 12, 13, 24, 25, 26])
const BOOKING = new Set([9, 10, 18, 19, 20, 30])

const PAINEL = 'rounded-xl border border-border bg-background p-5'

export function DashboardPreview() {
  return (
    <section className={SECCAO}>
      <div className={CONTENTOR}>
        <div className="reveal max-w-2xl">
          <h2 className={TITULO_SECCAO}>Tudo o que precisas num único lugar</h2>
          <p className={`mt-4 ${LEAD}`}>
            Calendário, obrigações legais e alojamentos no mesmo ecrã. O que tens
            de fazer hoje aparece primeiro.
          </p>
        </div>

        <figure className="reveal mt-12">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-40px_rgb(60_30_10/0.35)]">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="ml-3 text-xs text-muted-foreground">anfitrioes.pt/hoje</span>
            </div>

            <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
              <div className={`${PAINEL} lg:col-span-2`}>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">Calendário unificado</h3>
                  <span className="ml-auto text-xs text-muted-foreground">Julho</span>
                </div>
                <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 rounded-md sm:h-8 ${
                        AIRBNB.has(i) ? 'bg-primary/75' : BOOKING.has(i) ? 'bg-foreground/55' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/75" /> Airbnb
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-foreground/55" /> Booking
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-muted ring-1 ring-border" /> Livre
                  </span>
                </div>
              </div>

              <div className={PAINEL}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">Conformidade</h3>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {CONFORMIDADE.map((c) => (
                    <li key={c.titulo} className="rounded-lg bg-muted p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            c.estado === 'ok' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-500 dark:bg-amber-400'
                          }`}
                        />
                        <span className="text-xs font-medium text-foreground">{c.titulo}</span>
                        <span className="sr-only">{c.estado === 'ok' ? '(em dia)' : '(por tratar)'}</span>
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted-foreground">{c.detalhe}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={`${PAINEL} lg:col-span-3`}>
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-primary" aria-hidden />
                  <h3 className="text-sm font-semibold text-foreground">Alojamentos</h3>
                  {/* Sem métrica de resultado: um "+12% ocupação" sem cliente que
                      o sustente é uma alegação comercial não comprovável
                      (Diretiva Omnibus), não um detalhe decorativo. */}
                  <span className="ml-auto text-xs text-muted-foreground">3 alojamentos</span>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {PROPRIEDADES.map((p) => (
                    <li key={p.nome} className="rounded-lg bg-muted p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-medium text-foreground">{p.nome}</span>
                        <span className="tabular text-xs text-muted-foreground">{p.ocupacao}%</span>
                      </div>
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${p.ocupacao}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{p.estado}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <figcaption className="mt-4 text-center text-xs text-muted-foreground">
            Ilustração do painel com dados de exemplo.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

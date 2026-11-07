import { X, Check } from 'lucide-react'
import { CONTENTOR, SECCAO, TITULO_SECCAO, LEAD } from './estilos'

const PROBLEMA = [
  'Airbnb, Booking e o email, cada um no seu separador',
  'Boletins do SIBA escritos à mão, hóspede a hóspede',
  'Taxa turística e mapa do INE feitos numa folha de cálculo',
]

const SOLUCAO = [
  'Um calendário com todas as plataformas',
  'O hóspede preenche os dados antes de chegar',
  'Taxa, INE e boletins prontos, com comprovativo',
]

export function ProblemSolution() {
  return (
    <section id="plataforma" className={`${SECCAO} scroll-mt-16`}>
      <div className={CONTENTOR}>
        <div className="reveal max-w-2xl">
          <h2 className={TITULO_SECCAO}>Menos separadores. Menos papelada.</h2>
          <p className={`mt-4 ${LEAD}`}>
            Ter um AL em Portugal é metade hospitalidade, metade burocracia. O
            Anfitrião trata da segunda.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="reveal rounded-2xl border border-border bg-card p-7 sm:p-9">
            <p className="text-sm font-semibold text-muted-foreground">Hoje</p>
            <ul className="mt-5 space-y-4">
              {PROBLEMA.map((item) => (
                <li key={item} className="flex items-start gap-3 text-muted-foreground">
                  <X className="mt-1 size-4 shrink-0" aria-hidden />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal rounded-2xl border border-primary/30 bg-primary/[0.06] p-7 sm:p-9">
            <p className="text-sm font-semibold text-primary">Com o Anfitrião</p>
            <ul className="mt-5 space-y-4">
              {SOLUCAO.map((item) => (
                <li key={item} className="flex items-start gap-3 text-foreground">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

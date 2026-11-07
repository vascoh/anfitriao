import { ChevronDown } from 'lucide-react'
import { PERGUNTAS } from './faq-data'
import { CONTENTOR, FAIXA, SECCAO, TITULO_SECCAO } from './estilos'

/**
 * `<details>` nativo: abre e fecha sem JavaScript, é acessível por teclado
 * e leitor de ecrã sem ARIA à mão, e o texto das respostas está no HTML para
 * o Google (é o mesmo do FAQPage em JSON-LD).
 */
export function FAQ() {
  return (
    <section className={`${SECCAO} ${FAIXA}`}>
      <div className={`${CONTENTOR} grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16`}>
        <div className="reveal">
          <h2 className={TITULO_SECCAO}>Perguntas frequentes</h2>
          <p className="mt-4 text-muted-foreground">
            Outra dúvida?{' '}
            <a
              href="mailto:suporte@anfitrioes.pt"
              className="font-semibold text-primary underline underline-offset-4"
            >
              suporte@anfitrioes.pt
            </a>
          </p>
        </div>

        <div className="reveal divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
          {PERGUNTAS.map((item, i) => (
            <details key={item.pergunta} open={i === 0} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-medium text-foreground">{item.pergunta}</h3>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180 group-open:text-primary"
                  aria-hidden
                />
              </summary>
              <p className="px-6 pb-6 text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

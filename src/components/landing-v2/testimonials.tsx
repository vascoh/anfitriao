import { Quote } from 'lucide-react'
import { CONTENTOR, SECCAO, TITULO_SECCAO } from './estilos'

type Testemunho = {
  citacao: string
  nome: string
  cargo: string
  iniciais: string
}

/**
 * Depoimentos reais e autorizados. Vazio de propósito: publicar testemunhos
 * inventados num site comercial é prática proibida na UE (Diretiva Omnibus).
 * Enquanto estiver vazio a secção não é renderizada — basta acrescentar
 * entradas verdadeiras para ela voltar ao ar.
 *
 * Grelha estática em vez de carrossel: todos ficam visíveis, sem JS e sem
 * texto a mudar sozinho debaixo de quem está a ler.
 */
const TESTEMUNHOS: Testemunho[] = []

export function Testimonials() {
  if (TESTEMUNHOS.length === 0) return null

  return (
    <section className={SECCAO}>
      <div className={CONTENTOR}>
        <h2 className={`reveal max-w-2xl ${TITULO_SECCAO}`}>
          Anfitriões que já recuperaram o tempo
        </h2>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TESTEMUNHOS.map((t) => (
            <li key={t.nome} className="reveal">
              <figure className="flex h-full flex-col rounded-2xl border border-border bg-card p-7">
                <Quote className="size-6 text-primary/50" aria-hidden />
                <blockquote className="mt-4 flex-1 leading-relaxed text-foreground">
                  “{t.citacao}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {t.iniciais}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{t.nome}</span>
                    <span className="block text-xs text-muted-foreground">{t.cargo}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

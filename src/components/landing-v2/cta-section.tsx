import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { TRIAL_DIAS } from '@/lib/planos'
import { CONTENTOR, SECCAO } from './estilos'

/**
 * Último bloco da página: a única superfície grande em terracota. O resto da
 * página guarda o acento para botões e realces, para este ter peso.
 */
export function CTASection() {
  return (
    <section className={SECCAO}>
      <div className={CONTENTOR}>
        <div className="reveal relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-12 sm:py-20">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_0%,rgb(255_255_255/0.16),transparent_70%)]"
          />
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-balance text-primary-foreground sm:text-4xl">
            Pronto para simplificar a gestão?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/90">
            {TRIAL_DIAS} dias grátis. Sem cartão de crédito. Sem compromisso.
          </p>

          <Link
            href="/sign-up"
            className="group mt-10 inline-flex h-14 items-center gap-2 rounded-xl bg-background px-8 text-base font-semibold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-foreground"
          >
            Começar agora
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}

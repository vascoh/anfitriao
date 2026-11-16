import { Fragment } from 'react'
import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { TRIAL_DIAS } from '@/lib/planos'
import { HeroVisual } from './hero-visual'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CONTENTOR } from './estilos'

// Posicionamento decidido a 2026-11-16: «a tua conformidade, com prova».
const TITULO = ['A', 'tua', 'conformidade,', 'com', 'prova.']
/** Depois desta palavra muda de linha; daí para a frente vai a terracota. */
const QUEBRA = 2

/**
 * Componente de servidor: o título, o texto e os botões chegam no HTML e
 * aparecem no primeiro desenho. A entrada é só CSS (`.word-up`, `.fade-up`)
 * e respeita o `prefers-reduced-motion` global.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      {/* Luz quente vinda de cima: o mesmo terracota, muito diluído. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_70%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]"
      />

      <div className={`${CONTENTOR} grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16`}>
        <div>
          <p className="fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            Feito para o Alojamento Local português
          </p>

          <h1 className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.035em] text-foreground sm:text-6xl lg:text-7xl">
            {/* O espaço tem de ser um nó de texto entre os spans, não uma margem:
                com margem o H1 fica visualmente certo mas o textContent é
                "Atuaconformidade,comprova." para o Google e para os leitores
                de ecrã. Dentro do inline-block seria descartado, por isso vai
                fora dele. */}
            {TITULO.map((palavra, i) => (
              <Fragment key={palavra}>
                <span className="inline-block overflow-hidden align-bottom pb-[0.06em]">
                  <span
                    className={`word-up ${i > QUEBRA ? 'text-primary' : ''}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {palavra}
                  </span>
                </span>
                {i === QUEBRA ? <br /> : i < TITULO.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </h1>

          <p
            className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl"
            style={{ animationDelay: '150ms' }}
          >
            SIBA, taxa turística e INE feitos a partir das tuas reservas. Cada
            boletim enviado fica registado com a resposta do serviço, pronto a
            mostrar numa inspeção.
          </p>

          <div
            className="fade-up mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: '250ms' }}
          >
            <Link href="/sign-up" className={`${BOTAO_PRIMARIO} group h-13 px-7 text-base`}>
              Testar grátis {TRIAL_DIAS} dias
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="#prova" className={`${BOTAO_SECUNDARIO} h-13 px-7 text-base`}>
              Ver o dossiê
            </Link>
          </div>

          <p className="fade-up mt-5 text-sm text-muted-foreground" style={{ animationDelay: '300ms' }}>
            Sem cartão de crédito. Cancelas quando quiseres.
          </p>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}

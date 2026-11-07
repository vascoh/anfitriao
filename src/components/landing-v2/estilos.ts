/**
 * Classes partilhadas da landing e das páginas legais.
 *
 * Só tokens da marca (`globals.css`): o mesmo fundo quente, o mesmo terracota
 * e a mesma tipografia da app. A landing antiga tinha paleta própria (slate,
 * ciano, esmeralda, Inter) e quem se inscrevia entrava noutro produto. O teste
 * `marca.test.ts` impede que paletas soltas voltem a entrar aqui.
 */

export const CONTENTOR = 'mx-auto max-w-[1200px] px-4 sm:px-8'

export const SECCAO = 'py-20 sm:py-28'

/** Faixa alternada: dá ritmo à página sem acrescentar cor. */
export const FAIXA = 'border-y border-border bg-card'

export const FOCO =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'

export const ANTETITULO = 'text-sm font-semibold text-primary'

export const TITULO_SECCAO =
  'text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl'

export const LEAD = 'text-lg leading-relaxed text-pretty text-muted-foreground'

export const CARTAO = 'rounded-2xl border border-border bg-background'

export const BOTAO_PRIMARIO = `inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary/90 active:translate-y-px ${FOCO}`

export const BOTAO_SECUNDARIO = `inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background font-semibold text-foreground transition-colors hover:bg-muted ${FOCO}`

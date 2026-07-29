import type { Variants, Transition } from 'motion/react'

/**
 * Variantes partilhadas pela landing v2.
 * Regras do design system: fade-in a 500ms ease-out, stagger de 100ms
 * entre itens, revelação de texto palavra a palavra a 50ms.
 */

export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1]

/** Threshold usado por todos os `whileInView` da página. */
export const VIEWPORT = { once: true, amount: 0.15 } as const

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } },
}

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: 0.15, ease: EASE_OUT },
  },
}

/** Contentor com stagger de 100ms — o padrão para grelhas de cartões. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

/** Contentor rápido (50ms) — revelação de título palavra a palavra. */
export const wordContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05 },
  },
}

export const wordReveal: Variants = {
  hidden: { opacity: 0, y: '0.4em' },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: EASE_OUT },
  },
}

/** Hover partilhado por botões e cartões. */
export const hoverLift = {
  scale: 1.05,
  transition: { duration: 0.2, ease: EASE_OUT },
} as const

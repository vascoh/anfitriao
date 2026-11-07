/**
 * Vibração curta de confirmação, como numa app nativa.
 *
 * Só em aparelhos que a suportam (Android; o Safari no iPhone não expõe
 * `navigator.vibrate`) e nunca a quem pediu menos movimento. Falhar em
 * silêncio é o comportamento certo: é um reforço, nunca a única pista.
 */
export type TipoVibracao = 'sucesso' | 'aviso' | 'toque'

const PADROES: Record<TipoVibracao, number | number[]> = {
  toque: 10,
  sucesso: [12, 40, 18],
  aviso: [30, 60, 30],
}

export function vibrar(tipo: TipoVibracao = 'sucesso'): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return false
  }
  try {
    return navigator.vibrate(PADROES[tipo])
  } catch {
    return false
  }
}

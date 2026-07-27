import { Playfair_Display, Poppins } from 'next/font/google'

// Fontes opcionais para o site público de cada anfitrião (settings.fonte).
// Mesma variável CSS em ambas para simplificar a aplicação condicional —
// só uma é carregada/aplicada de cada vez, consoante a escolha do tenant.
const fontSerif = Playfair_Display({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-tenant', display: 'swap' })
const fontArredondada = Poppins({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-tenant', display: 'swap' })

/** Devolve o next/font a aplicar, ou null para manter a fonte default (Geist). */
export function fontForSetting(fonte: string | null | undefined) {
  if (fonte === 'serif') return fontSerif
  if (fonte === 'arredondada') return fontArredondada
  return null
}

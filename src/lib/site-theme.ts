import type { CSSProperties } from 'react'
import { HEX_RE } from './color'
import { fontForSetting } from './fonts'
import type { WebsiteSettings } from './types'

/** Cor + fonte do tenant, prontas a aplicar num wrapper (style + className). */
export function siteTheme(settings: Pick<WebsiteSettings, 'cor_primaria' | 'fonte'>): { style: CSSProperties; className: string } {
  const font = fontForSetting(settings.fonte)
  const style: CSSProperties = {
    ...(settings.cor_primaria && HEX_RE.test(settings.cor_primaria) ? { '--primary': settings.cor_primaria } : {}),
    ...(font ? { fontFamily: 'var(--font-tenant)' } : {}),
  } as CSSProperties
  return { style, className: font?.variable ?? '' }
}

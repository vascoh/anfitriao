import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { htmlLang, hostFallbackBio, t } from './i18n'

/**
 * **Toda a página do site do anfitrião respeita o idioma escolhido.**
 *
 * O cabeçalho, o rodapé e a homepage estavam traduzidos desde julho; Sobre,
 * Galeria, Localização e as três páginas legais não — um site em inglês
 * mostrava ao hóspede «Falar com o anfitrião» e a política de privacidade em
 * português. Este teste obriga cada página de `/r/[slug]` a resolver o idioma
 * e a declará-lo no `lang` do HTML.
 */

const RAIZ = join(process.cwd(), 'src/app/r/[slug]')

function paginas(dir: string): string[] {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return nome === '_components' ? [] : paginas(caminho)
    return nome === 'page.tsx' ? [caminho] : []
  })
}

describe('site do anfitrião — idioma', () => {
  const todas = paginas(RAIZ)

  it('encontra as páginas', () => {
    expect(todas.length).toBeGreaterThanOrEqual(9)
  })

  for (const pagina of todas) {
    const rel = pagina.slice(RAIZ.length + 1)
    it(`${rel} resolve o idioma e declara-o no HTML`, () => {
      const codigo = readFileSync(pagina, 'utf-8')
      expect(codigo).toContain('resolveLang(')
      expect(codigo).toContain('lang={htmlLang(lang)}')
    })
  }

  it('htmlLang e textos auxiliares', () => {
    expect(htmlLang('en')).toBe('en')
    expect(htmlLang('pt')).toBe('pt-PT')
    expect(hostFallbackBio('en', 'Casa Azul')).toContain('Casa Azul welcomes')
    expect(t('en', 'legal_privacy_title')).toBe('Privacy Policy')
  })
})

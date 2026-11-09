import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const codigo = readFileSync(join(process.cwd(), 'src/components/global-search.tsx'), 'utf8')

describe('pesquisa global no telemóvel', () => {
  it('abre como folha inferior e respeita a área segura', () => {
    expect(codigo).toContain('items-end justify-center')
    expect(codigo).toContain('rounded-t-2xl')
    expect(codigo).toContain('env(safe-area-inset-bottom)')
    expect(codigo).toContain('sm:rounded-2xl')
  })

  it('prende e repõe o foco enquanto o diálogo está aberto', () => {
    expect(codigo).toContain("document.addEventListener('keydown', prenderFoco)")
    expect(codigo).toContain("document.removeEventListener('keydown', prenderFoco)")
    expect(codigo).toContain("document.body.style.overflow = 'hidden'")
    expect(codigo).toContain('focoAnteriorRef.current?.focus()')
  })

  it('tem nome e fecho acessíveis', () => {
    expect(codigo).toContain('aria-labelledby="pesquisa-global-titulo"')
    expect(codigo).toContain("q ? 'Limpar pesquisa' : 'Fechar pesquisa'")
    expect(codigo).toContain('min-h-11 min-w-11')
  })
})

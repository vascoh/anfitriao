import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NAV, CONTA_NAV, ADMIN_NAV, todosOsDestinos } from '@/lib/navigation'

/**
 * **O telemóvel chega aos mesmos sítios que o computador.**
 *
 * A aplicação é uma PWA: para a maioria dos anfitriões, o telemóvel não é a
 * versão reduzida — é a única. Um destino que só exista no menu lateral
 * (`hidden lg:flex`) não existe para quem gere os alojamentos ao fim do dia,
 * do sofá.
 *
 * Foi o que aconteceu ao painel de administração: estava escrito à mão dentro
 * do `side-nav` e em mais lado nenhum. No telemóvel não havia porta, e o ⌘K
 * também não o encontrava — só se lá chegava escrevendo o endereço, que é
 * precisamente o que não se faz num telefone.
 *
 * A defesa é estrutural: os dois menus leem as **mesmas** constantes. Um
 * destino novo entra em `navigation.ts` e aparece nos dois, ou não entra.
 */

const RAIZ = join(process.cwd(), 'src')

function ficheiro(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf-8')
}

const SIDE = ficheiro('components/side-nav.tsx')
const BOTTOM = ficheiro('components/bottom-nav.tsx')

describe('paridade entre o menu do telemóvel e o do computador', () => {
  it('ambos os menus leem as mesmas listas de destinos', () => {
    /* Um menu que construa a sua própria lista à mão é como o painel de
     * administração ficou só no computador durante meses. */
    for (const constante of ['NAV', 'CONTA_NAV', 'ADMIN_NAV']) {
      expect(SIDE, `side-nav não usa ${constante}`).toContain(constante)
      expect(BOTTOM, `bottom-nav não usa ${constante}`).toContain(constante)
    }
  })

  it('nenhum menu escreve um caminho à mão que não venha da navegação', () => {
    /* `href="/qualquer-coisa"` dentro de um menu é um destino que o outro menu
     * não conhece. As exceções são as rotas de autenticação, que não são
     * destinos de navegação — são para onde se sai. */
    const PERMITIDOS = ['/sign-in']
    const conhecidos = new Set([
      ...NAV.map(s => s.href),
      ...NAV.flatMap(s => s.children ?? []).map(c => c.href),
      ...CONTA_NAV.map(c => c.href),
      ...ADMIN_NAV.map(a => a.href),
      ...PERMITIDOS,
    ])

    for (const [nome, codigo] of [['side-nav', SIDE], ['bottom-nav', BOTTOM]] as const) {
      const escritos = [...codigo.matchAll(/href="(\/[^"{]*)"/g)].map(m => m[1])
      const forasteiros = escritos.filter(h => !conhecidos.has(h))
      expect(forasteiros, `${nome} tem caminhos fora da navegação`).toEqual([])
    }
  })

  it('o ⌘K encontra tudo o que os menus mostram', () => {
    // O atalho é a rede de segurança de quem não sabe em que secção mora o
    // que procura — e só é rede se alcançar o mesmo que os menus.
    const noMenu = [
      ...NAV.map(s => s.href),
      ...NAV.flatMap(s => s.children ?? []).map(c => c.href),
      ...CONTA_NAV.map(c => c.href),
      ...ADMIN_NAV.map(a => a.href),
    ]
    const naPesquisa = new Set(todosOsDestinos(true).map(d => d.href))

    expect(noMenu.filter(h => !naPesquisa.has(h))).toEqual([])
  })

  it('os destinos de administração só aparecem a quem é administrador', () => {
    const semAdmin = new Set(todosOsDestinos(false).map(d => d.href))
    for (const { href } of ADMIN_NAV) {
      expect(semAdmin.has(href), `${href} aparece a quem não é admin`).toBe(false)
    }
  })
})

describe('todas as páginas têm porta', () => {
  /**
   * Páginas que não são destinos de navegação, e porquê. Uma lista explícita
   * obriga a decidir — o esquecimento é que não pode passar em silêncio.
   */
  const SEM_MENU: Record<string, string> = {
    'conta/bem-vindo': 'passo do arranque, alcançado depois do registo',
    'conta/suspensa': 'estado de conta, para onde se é enviado',
    'conformidade/cartaz/[propertyId]': 'aberto a partir de /conformidade',
    'conformidade/dossie/[propertyId]': 'aberto a partir de /conformidade',
    'conformidade/ine': 'atalho no cabeçalho de /conformidade',
    'conformidade/taxa-turistica': 'atalho no cabeçalho de /conformidade',
  }

  /** Uma rota é contextual quando tem um parâmetro ou é uma ação sobre uma lista. */
  function eContextual(rota: string): boolean {
    return /\[|\/(nova|novo|editar)$/.test(rota)
  }

  function paginas(dir: string, prefixo = ''): string[] {
    return readdirSync(dir).flatMap(nome => {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        return paginas(caminho, prefixo ? `${prefixo}/${nome}` : nome)
      }
      return nome === 'page.tsx' && prefixo ? [prefixo] : []
    })
  }

  it('nenhuma página fica sem forma de lá chegar', () => {
    const destinos = new Set(todosOsDestinos(true).map(d => d.href.replace(/^\//, '')))

    const orfas = paginas(join(RAIZ, 'app/(app)'))
      .filter(r => !destinos.has(r))
      .filter(r => !eContextual(r))
      .filter(r => !(r in SEM_MENU))

    expect(orfas).toEqual([])
  })
})

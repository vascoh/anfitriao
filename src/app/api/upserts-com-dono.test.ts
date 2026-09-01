import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda estrutural: um `upsert` com id vindo do cliente tem de ter guarda de
 * propriedade.
 *
 * Sem ela, um anfitrião autenticado manda o id de uma linha de outro e
 * sobrepõe-na — ficando ainda com o `owner_id`, o que faz o roubo parecer
 * legítimo. Aconteceu em seis rotas ao mesmo tempo (tarifas, price_rules,
 * platform_rates, automações, posts e despesas), todas escritas por cópia da
 * anterior, e nenhuma delas foi apanhada por um teste porque não havia
 * nenhum a olhar para isto. A regra já estava escrita no CLAUDE.md; faltava
 * quem a verificasse.
 */

const RAIZ = join(process.cwd(), 'src/app/api')

/** Rotas onde a propriedade não se prova pelo `owner_id` da linha. */
const EXCECOES: Record<string, string> = {
  'checkin/[bookingId]/route.ts':
    'rota pública: o hóspede não tem sessão, e a ligação deriva da reserva que o URL identifica',
  'push/route.ts':
    'a chave de conflito é o endpoint do browser, um segredo do próprio dispositivo',
  'newsletter/route.ts':
    'rota pública sem sessão e sem dono: a linha é o email. Como a chave vem do '
    + 'pedido e ninguém prova que é sua, a escrita usa ignoreDuplicates — a '
    + 'primeira subscrição manda e as seguintes não tocam na linha, portanto '
    + 'não há nada para sobrepor. A tabela tem RLS sem políticas: nem anon nem '
    + 'authenticated a leem.',
}

function ficheirosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ficheirosDeRota(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

describe('upserts em rotas de API', () => {
  it('todos os que aceitam id do cliente verificam o dono', () => {
    const infratores: string[] = []

    for (const caminho of ficheirosDeRota(RAIZ)) {
      const relativo = caminho.slice(RAIZ.length + 1)
      if (EXCECOES[relativo]) continue

      const codigo = readFileSync(caminho, 'utf-8')
      if (!codigo.includes('.upsert(')) continue

      const temGuarda =
        codigo.includes('canUpsertRow') ||
        // guarda equivalente escrita à mão (ex.: /api/properties)
        /existing\.owner_id !== userId|owner_id !== userId/.test(codigo)

      if (!temGuarda) infratores.push(relativo)
    }

    expect(infratores).toEqual([])
  })

  it('as exceções continuam a existir — uma exceção para um ficheiro apagado esconde uma rota nova', () => {
    for (const relativo of Object.keys(EXCECOES)) {
      const existe = ficheirosDeRota(RAIZ).some(c => c.endsWith(relativo))
      expect(existe, `${relativo} já não existe: tirar da lista de exceções`).toBe(true)
    }
  })
})

/**
 * A outra metade da mesma regra: **referências** a um alojamento.
 *
 * O guarda dos upserts olha para o id da própria linha. Faltava o id de outra
 * coisa que a linha aponta — um `property_id` vindo do **corpo do pedido**.
 * Foi por aí que passaram, sem ninguém dar por elas, a criação de reservas no
 * alojamento do vizinho, a despesa imputada a um alojamento alheio e o
 * histórico de preços escrito no de outro.
 *
 * A regra tem de distinguir duas origens que se parecem no código:
 *
 * - o id **vem do cliente** → precisa de `ownsProperty`;
 * - o id **vem da base**, já filtrado por `owner_id` → não precisa de nada,
 *   e exigir a chamada seria pedir uma verificação redundante.
 *
 * Por isso só se olha para valores que se consegue seguir até ao `req.json()`:
 * ou acedidos como `body.propriedade_id`, ou desestruturados do corpo. Uma
 * regra que apanhasse tudo o que se chama `property_id` daria quatro falsos
 * positivos — e um teste estrutural com falsos positivos ensina a ignorá-lo.
 */
describe('referências a alojamento vindas do cliente', () => {
  /** Nomes desestruturados de `await req.json()` num ficheiro. */
  function nomesVindosDoCorpo(codigo: string): string[] {
    const nomes: string[] = []
    const re = /const\s*\{([^}]*)\}\s*=\s*(await\s+)?(req\.json\(\)|body)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(codigo)) !== null) {
      for (const parte of m[1].split(',')) {
        const nome = parte.split(':').pop()!.trim().replace(/\s*=.*$/, '')
        if (nome) nomes.push(nome)
      }
    }
    return nomes
  }

  it('quem escreve um alojamento vindo do pedido verifica o dono', () => {
    const infratores: string[] = []

    for (const caminho of ficheirosDeRota(RAIZ)) {
      const codigo = readFileSync(caminho, 'utf-8')
      if (!/(insert|upsert)\(/.test(codigo)) continue

      // Guardado por `ownsProperty`…
      if (codigo.includes('ownsProperty')) continue
      /* …ou pelo equivalente: carregar a propriedade já filtrada pelo dono,
       * o que faz um id alheio devolver 404 antes de se escrever seja o que
       * for. É a mesma garantia por outro caminho. */
      if (/from\('properties'\)/.test(codigo) && /eq\('owner_id',\s*userId\)/.test(codigo)) continue

      const doCorpo = ['body.propriedade_id', 'body.property_id', ...nomesVindosDoCorpo(codigo)]
      const escreveDoCliente = doCorpo.some(nome =>
        new RegExp(`(propriedade_id|property_id):\\s*${nome.replace('.', '\\.')}\\b`).test(codigo),
      )

      if (escreveDoCliente) infratores.push(caminho.slice(RAIZ.length + 1))
    }

    expect(infratores).toEqual([])
  })
})

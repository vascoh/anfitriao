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

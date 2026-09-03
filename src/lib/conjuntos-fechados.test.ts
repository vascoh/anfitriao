import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * **O que o código aceita e o que a base aceita têm de ser a mesma coisa.**
 *
 * O plano Empresa existia no código desde agosto — no tipo, nos limites, no
 * mapeamento de preços do Stripe, na página de preços e na validação do painel
 * de administração. A base recusava-o: o CHECK ficara nos três planos
 * originais. Enquanto o `STRIPE_EMPRESA_PRICE_ID` não estivesse configurado
 * ninguém dava por isso; no dia em que estivesse, alguém pagava 99 € e a conta
 * nunca era ativada, com o Stripe a repetir o webhook durante três dias.
 *
 * A divergência é fácil de criar — acrescenta-se um valor ao tipo e esquece-se
 * a migração — e impossível de ver, porque nada falha até o valor novo ser
 * usado. Este teste lê os dois lados e compara-os.
 *
 * As restrições da base vivem em `supabase/migrations`. O ficheiro mais
 * recente a mexer num CHECK é o que vale — é assim que o Postgres o vê.
 */

const RAIZ = process.cwd()
const TYPES = readFileSync(join(RAIZ, 'src/lib/types.ts'), 'utf-8')
const ACCOUNTS = readFileSync(join(RAIZ, 'src/lib/accounts.ts'), 'utf-8')

/** Valores de um tipo união de literais: `type X = 'a' | 'b'`. */
function valoresDoTipo(codigo: string, nome: string): string[] {
  const m = codigo.match(new RegExp(`type ${nome}\\s*=\\s*([^\\n]+)`))
  if (!m) throw new Error(`tipo ${nome} não encontrado`)
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort()
}

/**
 * Valores de um CHECK nas migrações, lendo o **último** ficheiro que o define.
 * Aceita as duas formas que o projeto usa: `in (…)` e `= ANY (ARRAY[…])`.
 */
function valoresDoCheck(constraint: string): string[] {
  const dir = join(RAIZ, 'supabase/migrations')
  const ficheiros = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  let ultimo: string | null = null
  for (const f of ficheiros) {
    const sql = readFileSync(join(dir, f), 'utf-8')
    const i = sql.lastIndexOf(`add constraint ${constraint}`)
    if (i === -1) continue
    const trecho = sql.slice(i, i + 500)
    const dentro = trecho.match(/check\s*\([^(]*(?:in|ANY)\s*\(?\s*(?:ARRAY)?\s*[[(]([^\])]+)[\])]/i)
    if (dentro) ultimo = dentro[1]
  }

  if (!ultimo) throw new Error(`CHECK ${constraint} não encontrado nas migrações`)
  return [...ultimo.matchAll(/'([^']+)'/g)].map(x => x[1]).sort()
}

describe('os conjuntos fechados do código e da base coincidem', () => {
  const casos: Array<[string, string[], string]> = [
    ['BookingStatus', valoresDoTipo(TYPES, 'BookingStatus'), 'bookings_estado_check'],
    ['BookingSource', valoresDoTipo(TYPES, 'BookingSource'), 'bookings_origem_check'],
    ['AccountPlano', valoresDoTipo(ACCOUNTS, 'AccountPlano'), 'accounts_plano_check'],
  ]

  for (const [nome, doCodigo, constraint] of casos) {
    it(`${nome} ↔ ${constraint}`, () => {
      expect(doCodigo, `o tipo ${nome} ficou vazio — a leitura falhou`).not.toHaveLength(0)
      expect(valoresDoCheck(constraint), nome).toEqual(doCodigo)
    })
  }
})

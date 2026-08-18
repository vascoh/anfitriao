import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guardas estruturais nascidas de uma pergunta: **que verificações existem
 * num sítio e não noutro?**
 *
 * As respostas foram todas assimetrias sem razão de ser — apagar uma
 * propriedade ficava registado e apagar uma reserva não; rotas que enviam
 * email tinham limitador e outras não; o guarda de propriedade estava em
 * cinco rotas e faltava em duas. Nenhuma delas era uma decisão: eram sítios
 * por onde a regra não passou.
 */

const RAIZ = join(process.cwd(), 'src/app/api')

function ficheirosDeRota(dir: string): string[] {
  return readdirSync(dir).flatMap(nome => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ficheirosDeRota(caminho)
    return nome === 'route.ts' ? [caminho] : []
  })
}

function rotas(): Array<{ nome: string; codigo: string }> {
  return ficheirosDeRota(RAIZ).map(caminho => ({
    nome: caminho.slice(RAIZ.length + 1).replace('/route.ts', ''),
    codigo: readFileSync(caminho, 'utf-8'),
  }))
}

describe('quem gasta dinheiro ou incomoda terceiros tem teto', () => {
  /** Rotas que enviam email, chamam IA, guardam ficheiros ou chamam terceiros. */
  const CARAS = /emailService\.|client\.messages|@vercel\/blob|fetchIcalText/

  const EXCECOES: Record<string, string> = {
    'cron/automations': 'cron: corre uma vez por dia com o segredo, não à ordem de ninguém',
    'cron/payment-reminders': 'cron',
    'cron/compliance-alerts': 'cron',
    'cron/trial-reminders': 'cron',
    'cron/relatorio-mensal': 'cron',
    'cron/noites-orfas': 'cron',
    'cron/faturacao': 'cron',
    'cron/retencao': 'cron',
    'ical-proxy': 'pré-visualização de um feed: uma leitura, sem escrita nem envio',
  }

  it('todas têm limitador de pedidos', () => {
    const semTeto = rotas()
      .filter(r => CARAS.test(r.codigo))
      .filter(r => !EXCECOES[r.nome])
      .filter(r => !r.codigo.includes('checkRateLimit'))
      .map(r => r.nome)

    expect(semTeto).toEqual([])
  })
})

describe('o que se apaga fica registado', () => {
  /* Apagar uma reserva leva com ela o histórico, os pagamentos registados e a
   * ligação aos hóspedes. Apagar uma propriedade já ficava no `audit_log`
   * desde julho; a reserva não — e é a mesma classe de ação. */
  const IRREVERSIVEIS = ['bookings', 'properties']

  it('as rotas que eliminam entidades principais registam quem e o quê', () => {
    const semRegisto = rotas()
      .filter(r => IRREVERSIVEIS.includes(r.nome))
      .filter(r => /export async function DELETE/.test(r.codigo))
      .filter(r => !r.codigo.includes('logAudit'))
      .map(r => r.nome)

    expect(semRegisto).toEqual([])
  })
})

describe('nenhuma rota autenticada escreve sem saber de quem é', () => {
  it('todo o DELETE filtra por dono', () => {
    /* Um `delete().eq('id', …)` sem `owner_id` apaga a linha de quem o pedir.
     * Não aconteceu — mas é o erro mais fácil de cometer numa rota nova, e o
     * mais caro de descobrir depois. */
    const semFiltro = rotas()
      .filter(r => /export async function DELETE/.test(r.codigo))
      .filter(r => r.codigo.includes('auth()'))
      .filter(r => {
        const corpo = r.codigo.slice(r.codigo.indexOf('export async function DELETE'))
        // Ou filtra pelo dono, ou delega em código que o faz (ex.: emitir.ts).
        const filtra = /eq\('owner_id',\s*userId\)/.test(corpo)
        const delega = /(anonimizarHospede|emitirNotaCredito|logAudit)/.test(corpo)
        return !filtra && !delega
      })
      .map(r => r.nome)

    expect(semFiltro).toEqual([])
  })
})

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guarda estrutural: **nenhum cron responde sem o segredo**.
 *
 * Cada uma destas rotas é um URL público que faz coisas com consequências:
 * apaga dados pessoais (retenção), emite faturas comunicadas à AT, e manda
 * emails a hóspedes reais. Se uma delas ficar sem `checkCronAuth`, qualquer
 * pessoa que descubra o caminho consegue disparar essas ações à vontade —
 * incluindo repetir emails ou forçar a rotina de anonimização.
 *
 * Não é hipotético: a lista do `vercel.json` cresceu sete vezes desde a
 * primeira, sempre por cópia da anterior, e um esquecimento aqui não dá erro
 * nenhum — dá uma rota que funciona *bem de mais*.
 */

const RAIZ = join(process.cwd(), 'src/app/api/cron')
const VERCEL = join(process.cwd(), 'vercel.json')

function rotasDeCron(): string[] {
  return readdirSync(RAIZ)
    .filter(nome => statSync(join(RAIZ, nome)).isDirectory())
    .filter(nome => existsSync(join(RAIZ, nome, 'route.ts')))
}

describe('rotas de cron', () => {
  it('todas verificam o segredo antes de fazer seja o que for', () => {
    const abertas = rotasDeCron().filter(nome => {
      const codigo = readFileSync(join(RAIZ, nome, 'route.ts'), 'utf-8')
      return !codigo.includes('checkCronAuth')
    })

    expect(abertas).toEqual([])
  })

  it('a verificação vem antes de tocar na base de dados', () => {
    /* Um `checkCronAuth` depois da query já leu dados que não devia.
     *
     * Só se olha para **dentro do handler**: várias destas rotas definem
     * funções auxiliares acima do `GET`, e um `.from(` numa definição é
     * código que ainda não correu. Um teste estrutural que dá falsos
     * positivos ensina a ignorá-lo, que é pior do que não existir. */
    const foraDeOrdem = rotasDeCron().filter(nome => {
      const codigo = readFileSync(join(RAIZ, nome, 'route.ts'), 'utf-8')
      const inicioHandler = codigo.indexOf('export async function GET')
      if (inicioHandler === -1) return true

      const corpo = codigo.slice(inicioHandler)
      const guarda = corpo.indexOf('checkCronAuth(req)')
      const primeiraQuery = corpo.indexOf('.from(')
      return guarda === -1 || (primeiraQuery !== -1 && primeiraQuery < guarda)
    })

    expect(foraDeOrdem).toEqual([])
  })

  it('todas as rotas agendadas existem em código', () => {
    /* Um cron agendado para um caminho que não existe falha em silêncio
     * todos os dias: a Vercel regista um 404 que ninguém lê. */
    const config = JSON.parse(readFileSync(VERCEL, 'utf-8')) as { crons: Array<{ path: string }> }
    const emFalta = config.crons
      .map(c => c.path)
      .filter(caminho => {
        const relativo = caminho.replace(/^\/api\//, '')
        return !existsSync(join(process.cwd(), 'src/app/api', relativo, 'route.ts'))
      })

    expect(emFalta).toEqual([])
  })

  it('nenhuma rota de cron ficou sem agendamento', () => {
    // Uma rota que ninguém chama é trabalho que nunca corre.
    const config = JSON.parse(readFileSync(VERCEL, 'utf-8')) as { crons: Array<{ path: string }> }
    const agendadas = new Set(config.crons.map(c => c.path))
    const orfas = rotasDeCron().filter(nome => !agendadas.has(`/api/cron/${nome}`))

    expect(orfas).toEqual([])
  })
})

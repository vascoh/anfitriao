/**
 * Medir um feed iCal real — o que ele traz e como o Anfitrião o classificaria.
 *
 * Não é um teste: é uma ferramenta de diagnóstico que vive aqui para poder usar
 * a lógica **de produção** (`parseIcal`, `textoDizIndisponivel`) em vez de uma
 * cópia que se desviaria dela. Sem `FEED_URL` no ambiente, não corre — o
 * `npm test` normal ignora-a.
 *
 *   FEED_URL='https://ical.booking.com/v1/export?t=…' npx vitest run src/lib/medir-feed.test.ts
 *
 * Porque existe (`docs/MIGRACAO-AMENITIZ.md` § «O que tem de ser verdade no dia
 * do corte», ponto 2): `TEXTOS_DE_BLOQUEIO` inclui `closed`. Do Airbnb sabemos
 * a forma — `Reserved` para reserva, `Airbnb (Not available)` para bloqueio — e
 * está certa. Do Booking não sabemos. Se as reservas dele vierem com `CLOSED`
 * no SUMMARY, cada reserva real entra como bloqueio: sem link de check-in, sem
 * boletim SIBA, sem fatura. É o bug de 03/09 ao contrário, e este lado custa
 * 100–2.000 € por hóspede não comunicado.
 *
 * O que se lê no resultado: se um feed que tu sabes ter reservas aparecer aqui
 * com tudo em «BLOQUEIO», é esse o problema — e a correção é tirar ou estreitar
 * a frase que está a casar, em `lib/reservations.ts`.
 */

import { describe, it, expect } from 'vitest'
import { parseIcal } from './ical'
import { textoDizIndisponivel } from './reservations'

const FEED_URL = process.env.FEED_URL

/* Os feeds trazem dados de hóspedes reais. O SUMMARY mostra-se inteiro porque é
 * exatamente o que se está aqui para ver; o DESCRIPTION corta-se, porque é onde
 * o Airbnb põe contactos e não é preciso vê-lo todo para saber que lá está. */
function resumir(s: string, max = 100): string {
  if (!s) return '—'
  return s.length > max ? `${s.slice(0, max)}…` : s
}

describe.skipIf(!FEED_URL)('medir um feed iCal real', () => {
  it('diz o que o feed traz e como seria classificado', async () => {
    const res = await fetch(FEED_URL!, {
      headers: { 'User-Agent': 'Anfitriao/1.0 Calendar Sync', Accept: 'text/calendar,*/*' },
      signal: AbortSignal.timeout(20_000),
    })
    expect(res.ok, `o feed respondeu ${res.status}`).toBe(true)

    const texto = await res.text()
    const prodid = texto.split(/\r?\n/).find(l => l.toUpperCase().startsWith('PRODID'))?.trim()
    const eventos = parseIcal(texto)

    const linhas = eventos.map(ev => {
      /* A mesma pergunta que o `eBloqueio` faz a uma reserva importada: sem
       * hóspede e com `uid_externo`, o que decide é o texto do feed. */
      const bloqueio = textoDizIndisponivel(ev.summary)
      return {
        datas: `${ev.dtstart} → ${ev.dtend}`,
        summary: resumir(ev.summary),
        description: ev.description ? `${ev.description.length} car.: ${resumir(ev.description, 60)}` : '—',
        classificado: bloqueio ? 'BLOQUEIO' : 'reserva',
      }
    })

    const bloqueios = linhas.filter(l => l.classificado === 'BLOQUEIO').length
    const comDescricao = eventos.filter(e => e.description).length

    /* `process.stdout.write` e não `console.log`: o vitest 4 intercepta a
     * consola e não a mostra numa execução que passa — que é justamente a
     * única em que este ficheiro serve para alguma coisa. */
    const out = (s: string) => process.stdout.write(s + '\n')

    out('\n' + '='.repeat(72))
    out(`PRODID          ${prodid ?? '(nenhum)'}`)
    out(`Eventos         ${eventos.length}`)
    out(`Com DESCRIPTION ${comDescricao}`)
    out(`Classificação   ${bloqueios} bloqueio(s), ${eventos.length - bloqueios} reserva(s)`)
    out('='.repeat(72))
    for (const l of linhas) {
      out(`  ${l.datas}  [${l.classificado.padEnd(8)}]  SUMMARY: ${l.summary}`)
      if (l.description !== '—') out(`  ${' '.repeat(23)}  DESCRIPTION: ${l.description}`)
    }

    if (eventos.length > 0 && bloqueios === eventos.length) {
      out(
        '\n⚠️  TUDO classificado como bloqueio.\n' +
        '    Se este feed tem reservas reais, elas não vão gerar check-in nem\n' +
        '    boletim SIBA. Ver qual das frases de TEXTOS_DE_BLOQUEIO está a casar\n' +
        '    (lib/reservations.ts) e estreitá-la ou removê-la.',
      )
    }
    if (eventos.length === 0) {
      out('\n⚠️  Zero eventos. Ou o calendário está vazio, ou o URL não é um feed iCal.')
    }
  }, 30_000)
})

/**
 * Ler e escrever calendários iCal.
 *
 * Havia dois leitores de iCal no projeto: este e um dentro de
 * `api/ical-sync/route.ts`. O que tinha testes era este, e era o que **não**
 * era usado por nada — a sincronização, que é quem lê os feeds do Amenitiz e
 * das plataformas, usava o outro, sem um único teste. E não eram equivalentes:
 * este não desdobrava linhas (RFC 5545 §3.1 parte as linhas longas em várias,
 * com um espaço à frente da continuação) e inventava um UID aleatório para os
 * eventos que não trazem nenhum — o que, na sincronização, faria a mesma
 * reserva entrar de novo todas as noites, porque a deduplicação é pelo UID.
 *
 * Ficou um só, o da sincronização, aqui e com os testes à frente.
 */

export interface IcalEvent {
  uid: string
  dtstart: string
  dtend: string
  summary: string
}

/** `20260810` ou `20260810T140000Z` → `2026-08-10`. */
function parseIcalDate(s: string): string {
  const clean = s.replace(/T.*$/, '').trim()
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return clean
}

export function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = []
  /* Desdobrar antes de partir por linhas: uma continuação é um CRLF seguido de
   * espaço ou tab, e sem isto um UID longo — os do Booking são — ficava
   * cortado a meio, e o resto aparecia como uma linha à parte. */
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let inEvent = false
  let cur: IcalEvent = { uid: '', dtstart: '', dtend: '', summary: '' }

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') {
      inEvent = true
      cur = { uid: '', dtstart: '', dtend: '', summary: '' }
      continue
    }
    if (line.trim() === 'END:VEVENT') {
      /* Sem UID não se importa nada. É o que identifica a reserva do outro
       * lado: sem ele não há como saber, na noite seguinte, que já cá está. */
      if (inEvent && cur.uid && cur.dtstart && cur.dtend) events.push({ ...cur })
      inEvent = false
      continue
    }
    if (!inEvent) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).toUpperCase().split(';')[0]
    const val = line.slice(colon + 1).trim()

    if (key === 'UID') cur.uid = val
    else if (key === 'DTSTART') cur.dtstart = parseIcalDate(val)
    else if (key === 'DTEND') cur.dtend = parseIcalDate(val)
    else if (key === 'SUMMARY') cur.summary = val
  }

  return events
}

export function generateIcal(
  events: Array<{ uid: string; summary: string; start: string; end: string }>,
  calName = 'Anfitrião',
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Anfitriao//PT`,
    `X-WR-CALNAME:${calName}`,
  ]

  for (const ev of events) {
    const s = ev.start.replace(/-/g, '')
    const e = ev.end.replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTART;VALUE=DATE:${s}`,
      `DTEND;VALUE=DATE:${e}`,
      `SUMMARY:${ev.summary}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

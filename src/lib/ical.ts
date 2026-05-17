export interface IcalEvent {
  uid: string
  summary: string
  start: string
  end: string
}

function parseIsoDate(raw: string): string {
  const clean = raw.replace(/[TZ]/g, '').slice(0, 8)
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
}

export function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  let inEvent = false
  let uid = ''
  let summary = ''
  let start = ''
  let end = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      uid = summary = start = end = ''
      continue
    }
    if (line === 'END:VEVENT') {
      if (start && end && start < end) {
        events.push({ uid: uid || crypto.randomUUID(), summary, start, end })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    if (line.startsWith('UID:')) uid = line.slice(4)
    else if (line.startsWith('SUMMARY:')) summary = line.slice(8)
    else if (line.startsWith('DTSTART')) start = parseIsoDate(line.split(':').pop() ?? '')
    else if (line.startsWith('DTEND')) end = parseIsoDate(line.split(':').pop() ?? '')
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

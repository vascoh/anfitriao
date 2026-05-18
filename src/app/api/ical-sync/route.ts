import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { IcalFeed } from '@/lib/types'

// Parse an iCal date string (YYYYMMDD or YYYYMMDDTHHMMSSZ) to YYYY-MM-DD
function parseIcalDate(s: string): string {
  const clean = s.replace(/T.*$/, '').trim()
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return clean
}

// Minimal iCal VEVENT parser
function parseIcal(text: string): Array<{ uid: string; dtstart: string; dtend: string; summary: string }> {
  const events: Array<{ uid: string; dtstart: string; dtend: string; summary: string }> = []
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let inEvent = false
  let cur = { uid: '', dtstart: '', dtend: '', summary: '' }

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') { inEvent = true; cur = { uid: '', dtstart: '', dtend: '', summary: '' }; continue }
    if (line.trim() === 'END:VEVENT') {
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

export async function POST(req: NextRequest) {
  const { propertyId } = await req.json()
  if (!propertyId) return NextResponse.json({ error: 'propertyId required' }, { status: 400 })

  // Get property with ical_feeds
  const { data: propRow, error: propErr } = await supabase
    .from('properties')
    .select('id, ical_feeds')
    .eq('id', propertyId)
    .single()

  if (propErr || !propRow) return NextResponse.json({ error: 'Property not found' }, { status: 404 })

  const feeds: IcalFeed[] = (propRow.ical_feeds as IcalFeed[] | null) ?? []
  if (feeds.length === 0) return NextResponse.json({ synced: 0, message: 'No feeds configured' })

  const origin = new URL(req.url).origin
  const results: Array<{ feed: string; imported: number; skipped: number; error?: string }> = []
  const updatedFeeds: IcalFeed[] = []

  for (const feed of feeds) {
    try {
      const proxyUrl = `${origin}/api/ical-proxy?url=${encodeURIComponent(feed.url)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const events = parseIcal(text)

      let imported = 0
      let skipped = 0

      for (const ev of events) {
        const uid = `${feed.id}::${ev.uid}`
        // Check if already exists
        const { data: existing } = await supabase
          .from('bookings')
          .select('id')
          .eq('propriedade_id', propertyId)
          .eq('uid_externo', uid)
          .maybeSingle()

        if (existing) { skipped++; continue }

        // Create blocked booking
        const { error: insertErr } = await supabase.from('bookings').insert({
          id: crypto.randomUUID(),
          propriedade_id: propertyId,
          hospede_id: null,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          num_hospedes: 1,
          estado: 'confirmada',
          origem: feed.source,
          preco_total: 0,
          preco_pago: 0,
          notas: ev.summary || `Importado de ${feed.nome}`,
          uid_externo: uid,
          criado_em: new Date().toISOString(),
          historico: [],
        })

        if (insertErr) { skipped++; continue }
        imported++
      }

      updatedFeeds.push({ ...feed, last_sync: new Date().toISOString(), last_count: events.length, error: undefined })
      results.push({ feed: feed.nome, imported, skipped })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updatedFeeds.push({ ...feed, last_sync: new Date().toISOString(), error: msg })
      results.push({ feed: feed.nome, imported: 0, skipped: 0, error: msg })
    }
  }

  // Update feeds metadata
  await supabase.from('properties').update({ ical_feeds: updatedFeeds }).eq('id', propertyId)

  const totalImported = results.reduce((s, r) => s + r.imported, 0)
  return NextResponse.json({ synced: totalImported, results })
}

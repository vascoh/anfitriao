import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase'
import type { IcalFeed } from '@/lib/types'
import { checkCronAuth } from '@/lib/cron-auth'
import { fetchIcalText } from '@/lib/ical-fetch'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  reconciliarPropriedade, uidDeOrigem,
  type ReservaImportada, type EventoDoFeed,
} from '@/lib/ical-reconciliacao'
import { today } from '@/lib/utils'
const supabase = createAdminClient()

function parseIcalDate(s: string): string {
  const clean = s.replace(/T.*$/, '').trim()
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`
  }
  return clean
}

function parseIcal(text: string): Array<{ uid: string; dtstart: string; dtend: string; summary: string }> {
  const events: Array<{ uid: string; dtstart: string; dtend: string; summary: string }> = []
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let inEvent = false
  let cur = { uid: '', dtstart: '', dtend: '', summary: '' }

  for (const line of lines) {
    if (line.trim() === 'BEGIN:VEVENT') {
      inEvent = true
      cur = { uid: '', dtstart: '', dtend: '', summary: '' }
      continue
    }
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

interface ResultadoFeed {
  feed: string
  imported: number
  skipped: number
  /** Reservas cujas datas mudaram do outro lado. */
  atualizadas?: number
  /** Reservas que desapareceram do feed — canceladas na plataforma. */
  canceladas?: number
  error?: string
}

async function syncProperty(
  propertyId: string,
  feeds: IcalFeed[],
  ownerId: string,
): Promise<{ synced: number; results: ResultadoFeed[]; updatedFeeds: IcalFeed[] }> {
  const results: ResultadoFeed[] = []
  const updatedFeeds: IcalFeed[] = []

  /* Uma leitura só das reservas já importadas: serve para não reimportar e
   * para saber o que mudou do outro lado. */
  const { data: existingRows } = await supabase
    .from('bookings')
    .select('id, uid_externo, check_in, check_out, estado, historico')
    .eq('propriedade_id', propertyId)
    .not('uid_externo', 'is', null)

  const importadas = (existingRows ?? []) as ReservaImportada[]
  /* Deduplicação pelo UID **de origem**, não pela chave local: o `feed.id`
   * muda quando o anfitrião remove e volta a adicionar o mesmo calendário, e
   * comparar pela chave local reimportava a agenda toda em duplicado. */
  const uidsConhecidos = new Set(importadas.map(r => uidDeOrigem(r.uid_externo)))
  const hoje = today()

  const eventosDaPropriedade: EventoDoFeed[] = []
  let todosOsFeedsOk = true
  const contagemAnterior = feeds.reduce((s, f) => s + (f.last_count ?? 0), 0)

  for (const feed of feeds) {
    try {
      const text = await fetchIcalText(feed.url)
      const events = parseIcal(text)

      const newBookings: object[] = []
      let skipped = 0

      for (const ev of events) {
        // Datas inválidas nem contam como evento: não se importam nem contam
        // para a reconciliação (senão cancelavam a reserva que representam).
        if (!ev.dtstart || !ev.dtend || ev.dtstart >= ev.dtend) { skipped++; continue }

        eventosDaPropriedade.push({ uid: ev.uid, dtstart: ev.dtstart, dtend: ev.dtend })

        if (uidsConhecidos.has(ev.uid)) { skipped++; continue }

        newBookings.push({
          id: crypto.randomUUID(),
          propriedade_id: propertyId,
          owner_id: ownerId,
          hospede_id: null,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          num_hospedes: 1,
          estado: 'confirmada',
          origem: feed.source,
          preco_total: 0,
          preco_pago: 0,
          notas: ev.summary || `Importado de ${feed.nome}`,
          uid_externo: `${feed.id}::${ev.uid}`,
          criado_em: new Date().toISOString(),
          historico: [],
        })
        // Marcar já, para o feed seguinte não reinserir o mesmo UID.
        uidsConhecidos.add(ev.uid)
      }

      let imported = 0
      if (newBookings.length > 0) {
        const { error: insertErr, data: insertedData } = await supabase
          .from('bookings')
          .insert(newBookings)
          .select('id')

        if (insertErr) {
          console.error('[ical-sync] batch insert error:', insertErr)
          skipped += newBookings.length
        } else {
          imported = insertedData?.length ?? newBookings.length
        }
      }

      updatedFeeds.push({
        ...feed,
        last_sync: new Date().toISOString(),
        last_count: events.length,
        error: undefined,
      })
      results.push({ feed: feed.nome, imported, skipped })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ical-sync] feed "${feed.nome}" failed:`, msg)
      todosOsFeedsOk = false
      updatedFeeds.push({ ...feed, last_sync: new Date().toISOString(), error: msg })
      results.push({ feed: feed.nome, imported: 0, skipped: 0, error: msg })
    }
  }

  /* Seguir o outro lado, não só somar-lhe.
   *
   * O gestor de canais é a fonte de verdade do calendário: uma reserva
   * cancelada lá tem de libertar a data cá, e uma data alterada tem de ser
   * aplicada. Feito uma vez por propriedade, contra a união dos eventos de
   * todos os feeds — as travas estão em `lib/ical-reconciliacao.ts`. */
  const { paraAtualizar, paraCancelar } = reconciliarPropriedade({
    locais: importadas,
    eventos: eventosDaPropriedade,
    hoje,
    contagemAnterior,
    todosOsFeedsOk,
  })

  /* O que a sincronização muda fica escrito no histórico da reserva, e as
   * notas não se tocam: são o texto que a plataforma mandou. Sem isto o
   * anfitrião via a data mudar sozinha e não tinha como saber porquê. */
  const historicoDe = (id: string) => {
    const atual = importadas.find(r => r.id === id)?.historico
    return Array.isArray(atual) ? atual : []
  }

  for (const alt of paraAtualizar) {
    const { error } = await supabase
      .from('bookings')
      .update({
        check_in: alt.check_in,
        check_out: alt.check_out,
        historico: [...historicoDe(alt.id), {
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          tipo: 'sincronizacao',
          descricao: `Datas alteradas na plataforma: ${alt.antes} → ${alt.check_in} → ${alt.check_out}`,
        }],
      })
      .eq('id', alt.id)
      .eq('owner_id', ownerId)
    if (error) console.error('[ical-sync] atualizar datas', alt.id, error.message)
  }

  for (const canc of paraCancelar) {
    const { error } = await supabase
      .from('bookings')
      .update({
        estado: 'cancelada',
        historico: [...historicoDe(canc.id), {
          id: crypto.randomUUID(),
          data: new Date().toISOString(),
          tipo: 'cancelada',
          descricao: 'Deixou de constar no calendário da plataforma — cancelada do outro lado.',
        }],
      })
      .eq('id', canc.id)
      .eq('owner_id', ownerId)
    if (error) console.error('[ical-sync] cancelar', canc.id, error.message)
  }

  if (paraAtualizar.length > 0 || paraCancelar.length > 0) {
    for (const r of results) {
      if (r.error) continue
      r.atualizadas = paraAtualizar.length
      r.canceladas = paraCancelar.length
      break
    }
  }

  await supabase.from('properties').update({ ical_feeds: updatedFeeds }).eq('id', propertyId)

  return { synced: results.reduce((s, r) => s + r.imported, 0), results, updatedFeeds }
}

// Manual sync for a single property (POST from property edit page)
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  /* Cada chamada dispara um pedido por feed a servidores de terceiros. Sem
   * teto, um botão carregado repetidamente pode fazer o Airbnb ou o Booking
   * limitarem o **feed do anfitrião** — um castigo que ele leva sem perceber
   * porquê. O cron diário continua a passar por aqui sem limitação, porque
   * usa o outro handler. */
  const rl = checkRateLimit(`ical-sync:${userId}`, 12, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas sincronizações seguidas. Espera um minuto.' },
      { status: 429 },
    )
  }

  try {
    const body = await req.json()
    const { propertyId } = body

    if (!propertyId || typeof propertyId !== 'string') {
      return NextResponse.json({ error: 'propertyId required' }, { status: 400 })
    }

    const { data: propRow, error: propErr } = await supabase
      .from('properties')
      .select('id, owner_id, ical_feeds')
      .eq('id', propertyId)
      .eq('owner_id', userId)
      .single()

    if (propErr || !propRow) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const feeds: IcalFeed[] = (propRow.ical_feeds as IcalFeed[] | null) ?? []
    if (feeds.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No feeds configured' })
    }

    const { synced, results } = await syncProperty(propertyId, feeds, propRow.owner_id as string)
    return NextResponse.json({ synced, results })
  } catch (err) {
    console.error('[ical-sync] POST error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Cron: sync all active properties (GET called by Vercel cron)
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  try {
    const { data: props, error } = await supabase
      .from('properties')
      .select('id, owner_id, ical_feeds')
      .eq('ativo', true)

    if (error || !props) {
      return NextResponse.json({ error: 'Failed to load properties' }, { status: 500 })
    }

    const propsWithFeeds = props.filter(p => {
      const feeds = p.ical_feeds as IcalFeed[] | null
      return feeds && feeds.length > 0
    })

    if (propsWithFeeds.length === 0) {
      return NextResponse.json({ synced: 0, properties: 0, message: 'No feeds configured' })
    }

    let totalSynced = 0
    const summary: Array<{ propertyId: string; synced: number }> = []

    for (const prop of propsWithFeeds) {
      const feeds = prop.ical_feeds as IcalFeed[]
      const { synced } = await syncProperty(prop.id, feeds, (prop as { owner_id: string }).owner_id)
      totalSynced += synced
      summary.push({ propertyId: prop.id, synced })
    }

    return NextResponse.json({
      synced: totalSynced,
      properties: propsWithFeeds.length,
      summary,
      syncedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[ical-sync] GET error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

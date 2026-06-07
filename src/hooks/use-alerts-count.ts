'use client'

import { useEffect, useState } from 'react'
import { fetchBookings } from '@/lib/fetcher'
import { today } from '@/lib/utils'

let cached = { count: 0, at: 0 }

export function useAlertsCount() {
  const [count, setCount] = useState(cached.count)

  useEffect(() => {
    // 60s cache to avoid hammering the API on every nav re-render
    if (Date.now() - cached.at < 60_000) {
      // cached value already set during initial state
      return
    }

    let cancelled = false
    fetchBookings().then(bookings => {
      if (cancelled) return
      const t = today()
      const pendentes = bookings.filter(b => b.estado === 'pendente').length
      const pagamentosEmFalta = bookings.filter(b =>
        b.estado !== 'cancelada' && b.estado !== 'no_show' &&
        b.preco_pago < b.preco_total && b.check_in <= t
      ).length
      const esquecidosCheckin = bookings.filter(b => b.estado === 'confirmada' && b.check_in < t).length
      const total = pendentes + pagamentosEmFalta + esquecidosCheckin
      cached = { count: total, at: Date.now() }
      setCount(total)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [])

  return count
}

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Booking, Property } from '@/lib/types'
import { fmtMoney } from '@/lib/utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...resto}>{children}</a>
  ),
}))

import { CasaInteira } from './casa-inteira'
import { DetalhesReserva, CartaoPropriedade } from './resumo'
import { Historico } from './historico'

const reserva = (r: Partial<Booking>) => ({
  id: 'b1', propriedade_id: 'q1', estado: 'confirmada', origem: 'direto',
  check_in: '2026-11-02', check_out: '2026-11-05', num_hospedes: 2,
  preco_total: 300, preco_pago: 0, historico: [], ...r,
}) as Booking

const casa = { id: 'casa', nome: 'Casa Azul', parent_id: null } as Property
const q1 = { id: 'q1', nome: 'Quarto 1', parent_id: 'casa', cidade: 'Lisboa', capacidade: 2, cor: '#123456' } as Property
const q2 = { id: 'q2', nome: 'Quarto 2', parent_id: 'casa' } as Property

describe('detalhe da reserva — blocos extraídos', () => {
  it('Casa inteira soma o grupo sem contar quartos cancelados', () => {
    const html = renderToStaticMarkup(
      <CasaInteira
        booking={reserva({})}
        grupo={{
          reservas: [
            reserva({}),
            reserva({ id: 'b2', propriedade_id: 'q2', preco_total: 200, preco_pago: 50 }),
            reserva({ id: 'b3', propriedade_id: 'q2', estado: 'cancelada', preco_total: 999 }),
          ],
          props: [casa, q1, q2],
        }}
      />,
    )
    expect(html).toContain('Casa Azul — casa inteira')
    expect(html).toContain('2 quartos')
    expect(html).toContain(fmtMoney(500))
    expect(html).toContain(`já pagou ${fmtMoney(50)}`)
    expect(html).toContain('href="/reservas/b2"')
    expect(html).not.toContain(fmtMoney(1499))
  })

  it('Reserva e Propriedade mostram os dados', () => {
    const det = renderToStaticMarkup(<DetalhesReserva booking={reserva({})} noites={3} />)
    expect(det).toContain('3 noites')
    expect(det).toContain('Direto')
    const prop = renderToStaticMarkup(<CartaoPropriedade prop={q1} />)
    expect(prop).toContain('href="/propriedades/q1"')
    expect(prop).toContain('Lisboa · 2 pax')
  })

  it('Histórico lista do mais recente para o mais antigo', () => {
    const html = renderToStaticMarkup(
      <Historico historico={[
        { id: 'e1', data: '2026-10-01T10:00:00Z', tipo: 'nota', descricao: 'Primeiro' },
        { id: 'e2', data: '2026-10-02T10:00:00Z', tipo: 'nota', descricao: 'Segundo' },
      ]} />,
    )
    expect(html.indexOf('Segundo')).toBeLessThan(html.indexOf('Primeiro'))
  })
})

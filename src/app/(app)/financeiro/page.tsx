'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Plus, Trash2, Wallet, Download } from 'lucide-react'
import { fetchExpenses, fetchBookings, fetchProperties, fetchPlatformRates } from '@/lib/fetcher'
import { eliminar } from '@/lib/guardar'
import { fmtMoney, fmtDate, today } from '@/lib/utils'
import { SOURCE_LABEL } from '@/lib/labels'
import { ordenarComQuartos } from '@/lib/reservations'
import type { Expense, ExpenseCategoria, Booking, Property, PlatformRate } from '@/lib/types'

const CATEGORIA_LABEL: Record<ExpenseCategoria, string> = {
  limpeza: 'Limpeza',
  manutencao: 'Manutenção',
  comissoes: 'Comissões',
  utilidades: 'Utilidades (água, luz, internet)',
  marketing: 'Marketing',
  iva: 'IVA',
  outro: 'Outro',
}

function isActive(b: Booking) {
  return b.estado !== 'cancelada' && b.estado !== 'no_show'
}

/** Comissão retida pela plataforma numa reserva, se houver taxa configurada para a propriedade+plataforma e o preço estiver preenchido (reservas iCal chegam com preco_total=0 até o anfitrião o corrigir). */
function commissionFor(booking: Booking, platformRates: PlatformRate[]): number {
  if (booking.origem === 'direto' || booking.preco_total <= 0) return 0
  const rate = platformRates.find(r => r.property_id === booking.propriedade_id && r.plataforma === booking.origem && r.ativo)
  return rate ? booking.preco_total * (rate.comissao_pct / 100) : 0
}

/** CSV abre nativamente no Excel — evita adicionar uma dependência (.xlsx/PDF) para um ganho marginal. */
function buildFinanceCsv(
  expenses: Expense[], properties: Property[], year: number,
  receitaAno: number, despesaAno: number, comissaoAno: number,
): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const propName = (id?: string | null) => properties.find(p => p.id === id)?.nome ?? ''
  const cols = ['Data', 'Categoria', 'Descrição', 'Propriedade', 'Valor (€)']
  const rows = expenses
    .filter(e => e.data.startsWith(String(year)))
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(e => [e.data, CATEGORIA_LABEL[e.categoria], e.descricao, propName(e.propriedade_id), e.valor.toFixed(2)].map(esc).join(','))
  const summary = [
    '',
    ['', '', '', 'Receita ' + year, receitaAno.toFixed(2)].map(esc).join(','),
    ['', '', '', 'Despesas ' + year, despesaAno.toFixed(2)].map(esc).join(','),
    ['', '', '', 'Comissões plataformas ' + year + ' (estimado)', comissaoAno.toFixed(2)].map(esc).join(','),
    ['', '', '', 'Lucro líquido ' + year, (receitaAno - despesaAno - comissaoAno).toFixed(2)].map(esc).join(','),
  ]
  return [cols.map(esc).join(','), ...rows, ...summary].join('\n')
}

export default function FinanceiroPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [platformRates, setPlatformRates] = useState<PlatformRate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [categoria, setCategoria] = useState<ExpenseCategoria>('outro')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(today())
  const [propriedadeId, setPropriedadeId] = useState('')

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchExpenses(), fetchBookings(), fetchProperties(), fetchPlatformRates()]).then(([e, b, p, pr]) => {
      setExpenses(e)
      setBookings(b)
      // Casas e quartos: uma limpeza é de um quarto, a eletricidade é da casa.
      // Filtrar por `!parent_id` deixava de fora exatamente onde as reservas
      // vivem numa casa com quartos, e não havia forma de imputar a despesa.
      setProperties(ordenarComQuartos(p))
      setPlatformRates(pr)
      setLoading(false)
    })
  }, [ownerId])

  const year = new Date().getFullYear()

  const receitaAno = useMemo(() =>
    bookings
      .filter(b => isActive(b) && b.check_in.startsWith(String(year)))
      .reduce((sum, b) => sum + b.preco_total, 0),
    [bookings, year],
  )

  const despesaAno = useMemo(() =>
    expenses
      .filter(e => e.data.startsWith(String(year)))
      .reduce((sum, e) => sum + e.valor, 0),
    [expenses, year],
  )

  const bookingsAno = useMemo(() =>
    bookings.filter(b => isActive(b) && b.check_in.startsWith(String(year))),
    [bookings, year],
  )

  const comissaoAno = useMemo(() =>
    bookingsAno.reduce((sum, b) => sum + commissionFor(b, platformRates), 0),
    [bookingsAno, platformRates],
  )

  const comissaoPorPlataforma = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of bookingsAno) {
      const c = commissionFor(b, platformRates)
      if (c > 0) map.set(b.origem, (map.get(b.origem) ?? 0) + c)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [bookingsAno, platformRates])

  const temReservasSemPreco = useMemo(() =>
    bookingsAno.some(b => b.origem !== 'direto' && b.preco_total <= 0),
    [bookingsAno],
  )

  const lucroAno = receitaAno - despesaAno
  const lucroLiquidoAno = lucroAno - comissaoAno

  async function handleAdd() {
    if (!descricao.trim() || !valor || Number(valor) < 0) {
      toast.error('Preenche a descrição e o valor.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoria, descricao: descricao.trim(), valor: Number(valor), data,
          propriedade_id: propriedadeId || null,
        }),
      })
      if (!res.ok) throw new Error()
      setDescricao('')
      setValor('')
      setPropriedadeId('')
      setExpenses(await fetchExpenses())
      toast.success('Despesa registada')
    } catch {
      toast.error('Erro ao registar despesa')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    // A despesa desaparecia do ecrã e voltava ao recarregar a página.
    if (!await eliminar(`/api/expenses?id=${id}`)) return
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function exportCsv() {
    const csv = buildFinanceCsv(expenses, properties, year, receitaAno, despesaAno, comissaoAno)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `financeiro-${year}.csv`
    a.click()
  }

  const propName = (id?: string | null) => properties.find(p => p.id === id)?.nome

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        </header>
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
        <button onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-input rounded-lg px-3 py-1.5 transition-colors"
          title={`Exportar financeiro ${year} para CSV`}>
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </header>

      <div className="max-w-xl flex flex-col gap-6 p-4">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Receita {year}</p>
            <p className="text-lg font-bold mt-1">{fmtMoney(receitaAno)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Despesas {year}</p>
            <p className="text-lg font-bold mt-1">{fmtMoney(despesaAno)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lucro {year}</p>
            <p className={`text-lg font-bold mt-1 ${lucroAno < 0 ? 'text-destructive' : ''}`}>{fmtMoney(lucroAno)}</p>
          </div>
        </div>

        {/* Comissões por plataforma */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comissões por plataforma (estimado)</p>
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            {comissaoPorPlataforma.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {temReservasSemPreco
                  ? 'Há reservas de Airbnb/Booking sem preço registado — edita a reserva e preenche o valor para estimar a comissão retida.'
                  : 'Sem comissões a estimar. Configura as taxas em Preços → Plataformas e regista o preço das reservas indiretas.'}
              </p>
            ) : (
              <>
                {comissaoPorPlataforma.map(([origem, valor]) => (
                  <div key={origem} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{SOURCE_LABEL[origem as keyof typeof SOURCE_LABEL] ?? origem}</span>
                    <span className="font-medium">{fmtMoney(valor)}</span>
                  </div>
                ))}
                <div className="h-px bg-border" />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total comissões {year}</span>
                  <span className="font-semibold">{fmtMoney(comissaoAno)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Lucro líquido {year} (após comissões)</span>
                  <span className={`font-bold ${lucroLiquidoAno < 0 ? 'text-destructive' : ''}`}>{fmtMoney(lucroLiquidoAno)}</span>
                </div>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">
              Estimativa com base nas taxas de comissão configuradas por plataforma e no preço registado em cada reserva — não substitui o extrato oficial do Airbnb/Booking.
            </p>
          </div>
        </section>

        {/* Nova despesa */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Registar despesa
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value as ExpenseCategoria)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {(Object.keys(CATEGORIA_LABEL) as ExpenseCategoria[]).map(c => (
                  <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição</label>
            <input type="text" value={descricao} onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Produtos de limpeza"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Valor (€)</label>
              <input type="number" min={0} step={0.01} value={valor} onChange={e => setValor(e.target.value)}
                placeholder="0.00"
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Propriedade (opcional)</label>
              <select value={propriedadeId} onChange={e => setPropriedadeId(e.target.value)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todas / geral</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.parent_id ? `  ↳ ${p.nome}` : p.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> {saving ? 'A guardar...' : 'Adicionar despesa'}
          </button>
        </section>

        {/* Lista de despesas */}
        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Despesas registadas</p>
          {expenses.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground leading-relaxed">
              <p>Ainda não há despesas registadas.</p>
              <p className="mt-1">
                Sem elas, o lucro em cima é só a receita: limpezas, condomínio,
                água e comissões saem todos deste mesmo bolo. Usa o formulário
                acima para registar a primeira.
              </p>
            </div>
          ) : (
            expenses.map(e => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIA_LABEL[e.categoria]} · {fmtDate(e.data)}{propName(e.propriedade_id) ? ` · ${propName(e.propriedade_id)}` : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold shrink-0">{fmtMoney(e.valor)}</p>
                <button onClick={() => handleDelete(e.id)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Plus, Trash2, Wallet, Download } from 'lucide-react'
import { fetchExpenses, fetchBookings, fetchProperties } from '@/lib/fetcher'
import { fmtMoney, fmtDate, today } from '@/lib/utils'
import type { Expense, ExpenseCategoria, Booking, Property } from '@/lib/types'

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

/** CSV abre nativamente no Excel — evita adicionar uma dependência (.xlsx/PDF) para um ganho marginal. */
function buildFinanceCsv(expenses: Expense[], properties: Property[], year: number, receitaAno: number, despesaAno: number): string {
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
    ['', '', '', 'Lucro ' + year, (receitaAno - despesaAno).toFixed(2)].map(esc).join(','),
  ]
  return [cols.map(esc).join(','), ...rows, ...summary].join('\n')
}

export default function FinanceiroPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [categoria, setCategoria] = useState<ExpenseCategoria>('outro')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(today())
  const [propriedadeId, setPropriedadeId] = useState('')

  useEffect(() => {
    if (!ownerId) return
    Promise.all([fetchExpenses(), fetchBookings(), fetchProperties()]).then(([e, b, p]) => {
      setExpenses(e)
      setBookings(b)
      setProperties(p.filter(x => !x.parent_id))
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

  const lucroAno = receitaAno - despesaAno

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
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  function exportCsv() {
    const csv = buildFinanceCsv(expenses, properties, year, receitaAno, despesaAno)
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
                {properties.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
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
            <p className="text-sm text-muted-foreground py-6 text-center">Ainda não há despesas registadas.</p>
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

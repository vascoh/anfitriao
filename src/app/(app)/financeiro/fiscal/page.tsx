'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ArrowLeft, Download, Scale, AlertTriangle } from 'lucide-react'
import { fetchBookings, fetchExpenses, fetchPlatformRates, fetchProperties } from '@/lib/fetcher'
import { fmtMoney } from '@/lib/utils'
import {
  MODALIDADE_LABEL, coeficiente, mapaFiscal, parametrosDoAno, podeOptarPelaF,
  type Agregado, type ModalidadeAl,
} from '@/lib/fiscal-irs'
import { csvPacoteContabilista, modalidadeSugerida, paraMapaFiscal, resumoFiscalAnual } from '@/lib/pacote-contabilista'
import type { Booking, Expense, PlatformRate, Property } from '@/lib/types'

const ARMAZEM = 'anfitriao.fiscal.agregado'
const AGREGADO_INICIAL: Agregado & { precosComIva: boolean } = {
  outrosRendimentos: 0, conjunta: false, contribuicoesSs: 0, despesasNoEfatura: false, precosComIva: true,
}

function lerAgregado(): typeof AGREGADO_INICIAL {
  if (typeof window === 'undefined') return AGREGADO_INICIAL
  try {
    const bruto = localStorage.getItem(ARMAZEM)
    return bruto ? { ...AGREGADO_INICIAL, ...JSON.parse(bruto) } : AGREGADO_INICIAL
  } catch {
    return AGREGADO_INICIAL
  }
}

const num = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function MapaFiscalPage() {
  const { user } = useUser()
  const ano = new Date().getFullYear()
  const parametros = parametrosDoAno(ano)

  const [bookings, setBookings] = useState<Booking[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [rates, setRates] = useState<PlatformRate[]>([])
  const [loading, setLoading] = useState(true)
  // O esqueleto de carregamento não mostra estes valores, por isso ler o
  // localStorage no primeiro render não causa diferenças de hidratação.
  const [agregado, setAgregado] = useState(lerAgregado)
  useEffect(() => {
    try { localStorage.setItem(ARMAZEM, JSON.stringify(agregado)) } catch { /* sem armazenamento */ }
  }, [agregado])

  useEffect(() => {
    if (!user?.id) return
    Promise.all([fetchBookings(), fetchExpenses(), fetchProperties(), fetchPlatformRates()])
      .then(([b, e, p, r]) => { setBookings(b); setExpenses(e); setProperties(p); setRates(r) })
      .finally(() => setLoading(false))
  }, [user?.id])

  const resumo = useMemo(() => resumoFiscalAnual({
    ano, bookings, expenses, properties, platformRates: rates, precosComIva: agregado.precosComIva,
  }), [ano, bookings, expenses, properties, rates, agregado.precosComIva])

  const { alojamentos, semModalidade } = useMemo(() => paraMapaFiscal(resumo), [resumo])
  const mapa = useMemo(
    () => (parametros && alojamentos.length ? mapaFiscal(alojamentos, agregado, parametros) : null),
    [parametros, alojamentos, agregado],
  )

  async function gravarFiscal(p: Property, patch: Partial<Pick<Property, 'al_modalidade' | 'al_area_contencao' | 'vpt'>>) {
    const anterior = properties
    setProperties(ps => ps.map(x => (x.id === p.id ? { ...x, ...patch } : x)))
    const res = await fetch('/api/fiscal/alojamento', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ propertyId: p.id, ...patch }),
    })
    if (!res.ok) {
      setProperties(anterior)
      toast.error((await res.json().catch(() => null))?.error ?? 'Não foi possível gravar.')
    }
  }

  function descarregarPacote() {
    const blob = new Blob([csvPacoteContabilista(resumo)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pacote-contabilista-${ano}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const casas = properties.filter(p => !p.parent_id)
  const header = (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Link href="/financeiro" aria-label="Voltar ao financeiro" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight truncate">Mapa fiscal {ano}</h1>
      </div>
      <button onClick={descarregarPacote} disabled={loading}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-input rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
        title="CSV com resumo por alojamento, reservas e despesas do ano">
        <Download className="h-3.5 w-3.5" /> Pacote contabilista
      </button>
    </header>
  )

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        {header}
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
        </div>
      </div>
    )
  }

  const campo = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm'

  return (
    <div className="flex flex-col min-h-full pb-8">
      {header}
      <div className="max-w-xl flex flex-col gap-6 p-4">
        <p className="text-sm text-muted-foreground">
          IRS do alojamento local: categoria B (regime simplificado) ou a opção anual pela categoria F
          (art. 28.º, n.º 14 do CIRS, só para moradia e apartamento). É uma simulação para levar ao
          contabilista, não uma liquidação.
        </p>

        {/* Dados de cada estabelecimento */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Estabelecimentos</p>
          {casas.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há alojamentos.</p>}
          {casas.map(p => {
            const r = resumo.alojamentos.find(a => a.id === p.id)
            const sugestao = modalidadeSugerida(p)
            const coef = p.al_modalidade ? coeficiente(p.al_modalidade, p.al_area_contencao === true) : null
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex justify-between gap-3">
                  <p className="font-semibold truncate">{p.nome}</p>
                  <p className="text-sm text-muted-foreground shrink-0">
                    {r ? `${fmtMoney(r.receita)} · ${r.reservas} reservas` : 'sem reservas este ano'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    Modalidade no RNAL
                    <select className={campo} value={p.al_modalidade ?? ''}
                      onChange={e => gravarFiscal(p, { al_modalidade: (e.target.value || null) as ModalidadeAl | null })}>
                      <option value="">Por definir{sugestao ? ` (provável: ${MODALIDADE_LABEL[sugestao]})` : ''}</option>
                      {(Object.keys(MODALIDADE_LABEL) as ModalidadeAl[]).map(m => (
                        <option key={m} value={m}>{MODALIDADE_LABEL[m]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium">
                    VPT do imóvel (€)
                    <input className={campo} inputMode="decimal" defaultValue={p.vpt ?? ''} placeholder="da caderneta predial"
                      onBlur={e => {
                        const v = e.target.value.trim()
                        const novo = v === '' ? null : num(v)
                        if (novo !== (p.vpt ?? null)) gravarFiscal(p, { vpt: novo })
                      }} />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={p.al_area_contencao === true}
                    onChange={e => gravarFiscal(p, { al_area_contencao: e.target.checked })} />
                  Em área de contenção (definida pelo município)
                </label>
                {coef && (
                  <p className="text-[11px] text-muted-foreground">
                    Coeficiente {coef.valor.toLocaleString('pt-PT')} — art. 31.º, n.º 1, alínea {coef.alinea}) do CIRS
                    {p.al_modalidade && !podeOptarPelaF(p.al_modalidade) ? ' · sem opção pela categoria F' : ''}
                  </p>
                )}
              </div>
            )
          })}
        </section>

        {/* Agregado */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">O teu agregado</p>
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Rendimento coletável sem o AL (€/ano)
              <input className={campo} inputMode="decimal" defaultValue={agregado.outrosRendimentos || ''}
                placeholder="salários, pensões… já depois das deduções específicas"
                onBlur={e => setAgregado(a => ({ ...a, outrosRendimentos: num(e.target.value) }))} />
              <span className="font-normal text-muted-foreground">Decide o escalão onde o AL vai cair. Está na nota de liquidação do ano passado.</span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
              Contribuições para a Segurança Social por causa do AL (€/ano)
              <input className={campo} inputMode="decimal" defaultValue={agregado.contribuicoesSs || ''} placeholder="0"
                onBlur={e => setAgregado(a => ({ ...a, contribuicoesSs: num(e.target.value) }))} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agregado.conjunta}
                onChange={e => setAgregado(a => ({ ...a, conjunta: e.target.checked }))} />
              Tributação conjunta (casados ou unidos de facto)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agregado.despesasNoEfatura}
                onChange={e => setAgregado(a => ({ ...a, despesasNoEfatura: e.target.checked }))} />
              As despesas estão no e-fatura, afetas à atividade
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agregado.precosComIva}
                onChange={e => setAgregado(a => ({ ...a, precosComIva: e.target.checked }))} />
              Os meus preços incluem IVA (desmarcar se estiver isento pelo art. 53.º do CIVA)
            </label>
            <p className="text-[11px] text-muted-foreground">Estes valores ficam só neste navegador.</p>
          </div>
        </section>

        {/* Resultado */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Comparação
          </p>
          {!parametros && (
            <p className="text-sm text-muted-foreground">
              Os escalões de IRS de {ano} ainda não foram verificados nesta versão — o mapa volta quando forem.
            </p>
          )}
          {semModalidade.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Falta a modalidade de {semModalidade.join(', ')} — sem ela não se sabe o coeficiente, e ficam fora da conta.</span>
            </div>
          )}
          {parametros && !mapa && semModalidade.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem receita registada em {ano}.</p>
          )}
          {mapa && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`rounded-xl border bg-card p-4 ${mapa.recomendacao === 'B' ? 'border-primary' : 'border-border'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Categoria B (simplificado)</p>
                  <p className="text-2xl font-bold mt-1">{fmtMoney(mapa.b.imposto)}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Rendimento tributável {fmtMoney(mapa.b.rendimento)}
                    {mapa.b.acrescimoN13 > 0 && <> (inclui {fmtMoney(mapa.b.acrescimoN13)} da regra dos 15 %)</>}
                  </p>
                </div>
                <div className={`rounded-xl border bg-card p-4 ${mapa.recomendacao === 'F' ? 'border-primary' : 'border-border'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Opção pela categoria F</p>
                  {mapa.f.disponivel ? (
                    <>
                      <p className="text-2xl font-bold mt-1">{fmtMoney(mapa.f.imposto)}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Rendimento predial {fmtMoney(mapa.f.rendimentoF)},{' '}
                        {mapa.f.modo === 'autonoma' ? 'à taxa autónoma de 28 %' : 'englobado (sai mais barato que os 28 %)'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-2">Não disponível: só moradia e apartamento podem optar.</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
                {mapa.recomendacao === 'indiferente'
                  ? (mapa.f.disponivel ? 'As duas opções dão praticamente o mesmo imposto (menos de 50 € de diferença).' : 'Só a categoria B se aplica a estes alojamentos.')
                  : mapa.recomendacao === 'F'
                    ? <>Pela conta, a <strong>categoria F</strong> paga menos <strong>{fmtMoney(mapa.poupancaF)}</strong>.</>
                    : <>Pela conta, a <strong>categoria B</strong> paga menos <strong>{fmtMoney(-mapa.poupancaF)}</strong>.</>}
                <p className="text-[11px] text-muted-foreground mt-1">Imposto adicional que o AL acrescenta ao teu IRS, sobre uma receita de {fmtMoney(mapa.receitaTotal)}.</p>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground list-disc pl-4">
                {mapa.avisos.map(a => <li key={a}>{a}</li>)}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

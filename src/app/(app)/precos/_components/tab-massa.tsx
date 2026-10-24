'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { fmtMoney, uuid } from '@/lib/utils'
import { validarRegraPreco } from '@/lib/validacao-precos'
import type { Property, PriceRule, PriceRuleTipo } from '@/lib/types'
import { guardar } from '@/lib/guardar'
import { RULE_TIPO_LABEL, DIAS_SEMANA } from './constantes'

// ─── Tab: Atualização em Massa ─────────────────────────────────────────────────

export function TabMassa({
  props, onReload, showToast,
}: {
  props: Property[];
  onReload: () => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  const [selectedProps, setSelectedProps] = useState<string[]>([])
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [operacao, setOperacao] = useState<'pct' | 'fixo' | 'novo'>('pct')
  const [valor, setValor] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PriceRuleTipo>('seasonal')
  const [preview, setPreview] = useState<{ prop: string; antes: number; depois: number }[]>([])
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  function toggleProp(id: string) {
    setSelectedProps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  function toggleDia(d: number) {
    setDiasSemana(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function generatePreview() {
    if (selectedProps.length === 0) return
    const v = parseFloat(valor) || 0
    const p = selectedProps.map(pid => {
      const prop = props.find(p => p.id === pid)!
      const antes = prop.preco_base
      let depois = antes
      if (operacao === 'pct') depois = Math.round(antes * (1 + v / 100))
      else if (operacao === 'fixo') depois = Math.round(antes + v)
      else if (operacao === 'novo') depois = Math.round(v)
      // O cálculo nunca deixa um preço abaixo de zero; a pré-visualização
      // mostra o mesmo, senão prometia um número que não vai acontecer.
      depois = Math.max(0, depois)
      return { prop: prop.nome, antes, depois }
    })
    setPreview(p)
  }

  useEffect(() => {
    if (selectedProps.length > 0 && valor !== '') {
      const t = setTimeout(() => generatePreview(), 0)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setPreview([]), 0)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generatePreview é estável por closure; deps cobrem os inputs reais
  }, [selectedProps, valor, operacao])

  async function applyMassa() {
    if (selectedProps.length === 0 || !nome.trim()) return

    /* Validar antes de escrever em N propriedades de uma vez.
     *
     * A operação percentual aceitava −150, o que dava preços negativos, e um
     * intervalo invertido criava em cada alojamento uma regra que nunca se
     * aplica — o anfitrião ficava a pensar que a promoção estava a correr. */
    const v = parseFloat(valor) || 0
    const problema = validarRegraPreco({
      desconto_pct: operacao === 'pct' ? v : undefined,
      preco_noite: operacao === 'novo' ? v : undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      dias_semana: diasSemana.length > 0 ? diasSemana : undefined,
    })
    if (problema) {
      showToast(problema.mensagem, false)
      return
    }

    setApplying(true)
    try {
      for (const pid of selectedProps) {
        const rule: PriceRule = {
          id: uuid(),
          property_id: pid,
          nome: nome.trim(),
          tipo,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          dias_semana: diasSemana.length > 0 ? diasSemana : undefined,
          preco_noite: operacao === 'novo' ? v : undefined,
          desconto_pct: operacao === 'pct' ? v : operacao === 'fixo' ? undefined : undefined,
          prioridade: 10,
          ativo: true,
          criado_em: new Date().toISOString(),
        }
        // For 'fixo' mode, we compute the actual price difference
        if (operacao === 'fixo') {
          const prop = props.find(p => p.id === pid)!
          rule.preco_noite = prop.preco_base + v
        }
        // Numa atualização em massa, uma regra recusada em silêncio deixa um
        // alojamento com o preço antigo enquanto o anfitrião pensa que mudou.
        if (!await guardar('/api/price-rules', rule)) return
        fetch('/api/price-change-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId: pid, tipo: 'bulk_update', descricao: `Atualização em massa: ${nome.trim()}`, dadosNovos: { rule } }) }).catch(() => {})
      }
      showToast(`${selectedProps.length} propriedade(s) atualizadas`)
      setApplied(true)
      setTimeout(() => setApplied(false), 3000)
      onReload()
    } catch {
      showToast('Erro na atualização', false)
    }
    setApplying(false)
  }

  const inputCls = 'rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const labelCls = 'text-xs text-muted-foreground font-medium'

  return (
    <div className="flex flex-col gap-5 p-4 lg:p-8">
      <p className="text-sm text-muted-foreground">
        Cria uma regra de preço em massa para várias propriedades de uma vez. Útil para épocas, feriados e promoções.
      </p>

      {/* Step 1: Select properties */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">1. Selecionar propriedades</label>
          <button
            onClick={() => setSelectedProps(selectedProps.length === props.length ? [] : props.map(p => p.id))}
            className="text-xs text-primary font-medium"
          >
            {selectedProps.length === props.length ? 'Desselecionar todas' : 'Selecionar todas'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {props.map(p => (
            <button key={p.id} onClick={() => toggleProp(p.id)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                selectedProps.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}>
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.cor }} />
              <span className="flex-1 text-sm font-medium">{p.nome}</span>
              <span className="text-xs text-muted-foreground">{fmtMoney(p.preco_base)}/noite</span>
              {selectedProps.includes(p.id) && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Dates */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">2. Período (opcional)</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Data início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Data fim</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={labelCls}>Dias da semana (vazio = todos)</label>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS_SEMANA.map((d, i) => (
              <button key={i} onClick={() => toggleDia(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  diasSemana.includes(i) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step 3: Operation */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">3. Operação</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'pct' as const, label: '% Percentagem', desc: 'Ex: +20% verão' },
            { key: 'fixo' as const, label: '€ Valor fixo', desc: 'Ex: +15€ feriados' },
            { key: 'novo' as const, label: '€ Novo preço', desc: 'Ex: 80€ promoção' },
          ].map(op => (
            <button key={op.key} onClick={() => setOperacao(op.key)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                operacao === op.key ? 'border-primary bg-primary/5' : 'border-border bg-card'
              }`}>
              <p className="text-xs font-semibold">{op.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{op.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelCls}>
            {operacao === 'pct' ? 'Percentagem (ex: +20 ou -15)' : operacao === 'fixo' ? 'Valor em euros (+/-)' : 'Novo preço por noite (€)'}
          </label>
          <input
            type="number"
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder={operacao === 'pct' ? '+20' : operacao === 'fixo' ? '+15 ou -10' : '80'}
            className={inputCls}
          />
        </div>
      </div>

      {/* Step 4: Name & type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold">4. Nome e tipo da regra</label>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nome da regra</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Verão 2025" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as PriceRuleTipo)} className={inputCls}>
              {Object.entries(RULE_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pré-visualização</p>
          {preview.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="font-medium">{p.prop}</span>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">{fmtMoney(p.antes)}</span>
                <span className="text-muted-foreground">→</span>
                <span className={`font-semibold ${p.depois > p.antes ? 'text-emerald-600' : p.depois < p.antes ? 'text-red-600' : ''}`}>
                  {fmtMoney(p.depois)}
                </span>
                {p.depois !== p.antes && (
                  <span className={`text-[10px] font-medium ${p.depois > p.antes ? 'text-emerald-600' : 'text-red-600'}`}>
                    ({p.depois > p.antes ? '+' : ''}{Math.round(((p.depois - p.antes) / p.antes) * 100)}%)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={applyMassa}
        disabled={applying || selectedProps.length === 0 || !nome.trim() || !valor}
        className={`w-full rounded-xl py-3.5 font-semibold text-sm transition-colors disabled:opacity-40 ${
          applied ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'
        }`}
      >
        {applying ? 'A aplicar...' : applied ? 'Aplicado com sucesso!' : `Aplicar a ${selectedProps.length} propriedade${selectedProps.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

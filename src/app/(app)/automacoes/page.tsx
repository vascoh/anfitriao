'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Plus, Trash2, Zap, Eye } from 'lucide-react'
import { fetchAutomations } from '@/lib/fetcher'
import { fmtDate } from '@/lib/utils'
import { TRIGGER_LABEL, renderAutomationMessage, PREVIEW_VARS } from '@/lib/automations'
import type { Automation, AutomationTrigger } from '@/lib/types'

const PLACEHOLDERS = '{nome}, {propriedade}, {checkin}, {checkout}'

export default function AutomacoesPage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [automations, setAutomations] = useState<Automation[]>([])
  /* O que já saiu, por automação. Sem isto o anfitrião não tinha como
   * responder a "o hóspede diz que não recebeu o código". */
  const [historico, setHistorico] = useState<Record<string, { enviados: number; ultimo: string | null }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [nome, setNome] = useState('')
  const [trigger, setTrigger] = useState<AutomationTrigger>('checkin_amanha')
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => {
    if (!ownerId) return
    fetchAutomations().then(a => { setAutomations(a); setLoading(false) })
    fetch('/api/automacoes/historico')
      .then(r => (r.ok ? r.json() : {}))
      .then(setHistorico)
      .catch(() => {})
  }, [ownerId])

  async function handleAdd() {
    if (!nome.trim() || !mensagem.trim()) {
      toast.error('Preenche o nome e a mensagem.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), trigger_tipo: trigger, assunto: assunto.trim(), mensagem: mensagem.trim() }),
      })
      if (!res.ok) throw new Error()
      setNome(''); setAssunto(''); setMensagem('')
      setAutomations(await fetchAutomations())
      toast.success('Automação criada')
    } catch {
      toast.error('Erro ao criar automação')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAtivo(a: Automation) {
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...a, ativo: !a.ativo }),
    })
    setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/automations?id=${id}`, { method: 'DELETE' })
    setAutomations(prev => prev.filter(a => a.id !== id))
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
          <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
        </header>
        <div className="p-4 space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight">Automações</h1>
      </header>

      <div className="max-w-xl flex flex-col gap-6 p-4">

        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Nova automação
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Código da porta"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Quando enviar</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value as AutomationTrigger)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.keys(TRIGGER_LABEL) as AutomationTrigger[]).map(t => (
                <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Assunto do email (opcional)</label>
            <input type="text" value={assunto} onChange={e => setAssunto(e.target.value)}
              placeholder="Se vazio, usa o nome da automação"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Mensagem</label>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={4}
              placeholder={`Olá {nome}! O código da porta de {propriedade} é 1234.`}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-[11px] text-muted-foreground">Variáveis disponíveis: {PLACEHOLDERS}</p>
          </div>

          {mensagem.trim() && (
            <div className="rounded-lg border border-dashed border-input bg-muted/30 p-3 flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Pré-visualização (com dados de exemplo)
              </p>
              <p className="text-sm font-semibold">
                {renderAutomationMessage(assunto.trim() || nome.trim() || '(assunto)', PREVIEW_VARS)}
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {renderAutomationMessage(mensagem, PREVIEW_VARS)}
              </p>
            </div>
          )}

          <button onClick={handleAdd} disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity flex items-center justify-center gap-2">
            <Plus className="h-4 w-4" /> {saving ? 'A criar...' : 'Criar automação'}
          </button>
        </section>

        <section className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Automações ativas</p>
          {automations.length === 0 ? (
            <div className="py-6 px-4 text-center text-sm text-muted-foreground leading-relaxed">
              <p>Ainda não criaste nenhuma automação.</p>
              <p className="mt-1">
                As mais usadas: instruções de chegada na véspera do check-in,
                agradecimento no dia da saída e pedido de avaliação três dias
                depois. Cria-as no formulário acima.
              </p>
            </div>
          ) : (
            automations.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{TRIGGER_LABEL[a.trigger_tipo]} · email ao hóspede</p>
                  {(() => {
                    const h = historico[a.id]
                    if (!h) return null
                    if (h.enviados === 0) {
                      return <p className="text-[11px] text-muted-foreground/70 mt-0.5">ainda não enviou nenhuma vez</p>
                    }
                    return (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                        {h.enviados} {h.enviados === 1 ? 'envio' : 'envios'}
                        {h.ultimo && ` · último a ${fmtDate(h.ultimo.slice(0, 10))}`}
                      </p>
                    )
                  })()}
                </div>
                <button onClick={() => toggleAtivo(a)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${a.ativo ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${a.ativo ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0">
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

'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Copy, Check, AlertCircle, ChevronDown } from 'lucide-react'
import { db } from '@/lib/db'
import type { Property } from '@/lib/types'

const LANGS = [
  { code: 'pt', label: 'PT' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'it', label: 'IT' },
]

const TONES = [
  { id: 'profissional', label: 'Profissional' },
  { id: 'amigavel', label: 'Amigável' },
  { id: 'formal', label: 'Formal' },
]

const TEMPLATES = [
  {
    id: 'boas_vindas',
    label: 'Boas-vindas',
    text: 'Olá! Quando chegam exatamente? Quais são os detalhes da vossa viagem?',
  },
  {
    id: 'checkin_info',
    label: 'Info check-in',
    text: 'Podem explicar como funciona o check-in? A que horas podemos entrar?',
  },
  {
    id: 'wifi',
    label: 'Wi-Fi',
    text: 'Qual é a senha do Wi-Fi? Preciso de trabalhar remotamente.',
  },
  {
    id: 'checkout',
    label: 'Check-out',
    text: 'Até que horas temos de sair? Existe algum procedimento especial?',
  },
  {
    id: 'recomendacoes',
    label: 'Recomendações',
    text: 'Podem recomendar bons restaurantes e atrações perto do alojamento?',
  },
  {
    id: 'problema',
    label: 'Problema',
    text: 'Temos um problema no apartamento. A torneira da casa de banho está a pingar.',
  },
]

export default function ConciergePage() {
  const [message, setMessage] = useState('')
  const [targetLang, setTargetLang] = useState('en')
  const [tone, setTone] = useState('amigavel')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [selectedPropId, setSelectedPropId] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    db.getProperties().then(all => {
      const props = all.filter(p => p.ativo)
      setProperties(props)
      if (props.length > 0) setSelectedPropId(props[0].id)
    })
  }, [])

  const selectedProp = properties.find(p => p.id === selectedPropId)

  function applyTemplate(text: string) {
    setMessage(text)
    setReply('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setLoading(true)
    setReply('')
    setError('')

    const context = selectedProp ? {
      propertyName: selectedProp.nome,
      city: selectedProp.cidade,
      checkinInstructions: selectedProp.instrucoes_checkin,
      houseRules: selectedProp.regras_casa,
      amenities: selectedProp.comodidades,
    } : undefined

    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, targetLang, tone, context }),
        signal: abort.signal,
      })

      if (!res.ok) throw new Error('Erro ao gerar resposta')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream não disponível')

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setReply(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Não foi possível gerar a resposta. Verifica a tua API key.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight">Concierge IA</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Responde às mensagens dos hóspedes em segundos</p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4 pb-8">
        {/* Property selector */}
        {properties.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Propriedade</label>
            <div className="relative">
              <select
                value={selectedPropId}
                onChange={e => setSelectedPropId(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring pr-8"
              >
                <option value="">Sem contexto de propriedade</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
            {selectedProp && (
              <p className="text-xs text-muted-foreground">
                A IA usará as instruções e regras desta propriedade no contexto da resposta.
              </p>
            )}
          </div>
        )}

        {/* Templates */}
        <div className="flex flex-col gap-2">
          <span className="text-xs text-muted-foreground font-medium">Situações comuns</span>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.text)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-muted/60 text-foreground/70 hover:bg-muted hover:text-foreground transition-colors border border-border"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="message" className="text-xs text-muted-foreground font-medium">
            Mensagem do hóspede
          </label>
          <textarea
            id="message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Cola aqui a mensagem recebida em qualquer língua..."
            className="min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
          />
        </div>

        {/* Language + Tone */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Responder em</span>
            <div className="flex gap-1.5 flex-wrap">
              {LANGS.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setTargetLang(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    targetLang === lang.code
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-foreground/70 hover:bg-muted'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Tom</span>
            <div className="flex gap-1.5 flex-col">
              {TONES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors text-left ${
                    tone === t.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/60 text-foreground/70 hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={!message.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity">
          {loading ? (
            <><Sparkles className="h-4 w-4 animate-pulse" /> A gerar resposta...</>
          ) : (
            <><Sparkles className="h-4 w-4" /> Sugerir resposta</>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {(reply || loading) && !error && (
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {LANGS.find(l => l.code === targetLang)?.label} · {TONES.find(t => t.id === tone)?.label}
              </span>
              {reply && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5" /> Copiado</>
                    : <><Copy className="h-3.5 w-3.5" /> Copiar</>
                  }
                </button>
              )}
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap min-h-4">
              {reply}
              {loading && (
                <span className="inline-block w-0.5 h-4 ml-0.5 bg-primary align-middle animate-[pulse_1s_ease-in-out_infinite]" />
              )}
            </p>
          </div>
        )}
      </form>
    </div>
  )
}

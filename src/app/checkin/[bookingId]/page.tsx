'use client'

import { use, useState, useEffect, useRef } from 'react'
import { Camera, FileText, Check, AlertCircle, RotateCcw, ChevronRight, Loader2, Home } from 'lucide-react'

type Step = 'loading' | 'info' | 'camera' | 'review' | 'submitting' | 'done' | 'error' | 'already'

interface CheckinData {
  id: string
  check_in: string
  check_out: string
  num_hospedes: number
  estado: string
  property: { nome: string; cidade: string; imagem_url?: string } | null
  host_nome: string
  guest: Record<string, string> | null
  ja_submetido: boolean
}

interface GuestForm {
  nome: string
  email: string
  telefone: string
  nacionalidade: string
  numero_documento: string
  data_nascimento: string
  tipo_documento: string
  sexo: string
  pais_emissao: string
  data_validade_doc: string
}

const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome completo',
  data_nascimento: 'Data de nascimento',
  nacionalidade: 'Nacionalidade',
  numero_documento: 'Nº documento',
  tipo_documento: 'Tipo de documento',
  data_validade_doc: 'Validade',
  sexo: 'Sexo',
  pais_emissao: 'País de emissão',
  email: 'Email',
  telefone: 'Telefone',
}

const REQUIRED = ['nome', 'nacionalidade', 'numero_documento', 'data_nascimento', 'tipo_documento']

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T12:00:00'))
}

function nights(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

export default function CheckinPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = use(params)
  const [step, setStep] = useState<Step>('loading')
  const [data, setData] = useState<CheckinData | null>(null)
  const [form, setForm] = useState<GuestForm>({
    nome: '', email: '', telefone: '', nacionalidade: '', numero_documento: '',
    data_nascimento: '', tipo_documento: '', sexo: '', pais_emissao: '', data_validade_doc: '',
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/checkin/${bookingId}`)
      .then(r => r.json())
      .then((d: CheckinData & { error?: string }) => {
        if (d.error) { setStep('error'); return }
        setData(d)
        if (d.ja_submetido) { setStep('already'); return }
        if (d.guest) {
          setForm(prev => ({
            ...prev,
            nome: d.guest?.nome ?? '',
            email: d.guest?.email ?? '',
            telefone: d.guest?.telefone ?? '',
            nacionalidade: d.guest?.nacionalidade ?? '',
            numero_documento: d.guest?.numero_documento ?? '',
            data_nascimento: d.guest?.data_nascimento ?? '',
            tipo_documento: d.guest?.tipo_documento ?? '',
            sexo: d.guest?.sexo ?? '',
            pais_emissao: d.guest?.pais_emissao ?? '',
            data_validade_doc: d.guest?.data_validade_doc ?? '',
          }))
        }
        setStep('info')
      })
      .catch(() => setStep('error'))
  }, [bookingId])

  function handleFile(file: File) {
    setExtractError('')
    setPreview(URL.createObjectURL(file))
    setExtracting(true)
    const fd = new FormData()
    fd.append('file', file)
    fetch('/api/documentos/extrair', { method: 'POST', body: fd })
      .then(r => r.json())
      .then((extracted: Record<string, string>) => {
        setForm(prev => ({
          ...prev,
          nome: extracted.nome || prev.nome,
          data_nascimento: extracted.data_nascimento || prev.data_nascimento,
          nacionalidade: extracted.nacionalidade || prev.nacionalidade,
          numero_documento: extracted.numero_documento || prev.numero_documento,
          tipo_documento: extracted.tipo_documento || prev.tipo_documento,
          data_validade_doc: extracted.data_validade || prev.data_validade_doc,
          sexo: extracted.sexo || prev.sexo,
          pais_emissao: extracted.pais_emissao || prev.pais_emissao,
        }))
        setStep('review')
      })
      .catch(() => {
        setExtractError('Não foi possível ler o documento. Preenche os dados manualmente.')
        setStep('review')
      })
      .finally(() => setExtracting(false))
  }

  async function submit() {
    setSubmitError('')
    setStep('submitting')
    try {
      const res = await fetch(`/api/checkin/${bookingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setStep('done')
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setSubmitError(d.error ?? 'Erro ao guardar. Tenta novamente.')
        setStep('review')
      }
    } catch {
      setSubmitError('Sem ligação. Verifica a internet e tenta novamente.')
      setStep('review')
    }
  }

  const n = data ? nights(data.check_in, data.check_out) : 0

  if (step === 'loading') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div>
          <p className="font-semibold">Reserva não encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Verifica o link enviado pelo teu anfitrião.</p>
        </div>
      </div>
    )
  }

  if (step === 'already') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-lg">Check-in já submetido</p>
          <p className="text-sm text-muted-foreground mt-1">Os teus dados foram registados. Boa estadia em {data?.property?.nome}!</p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5 px-6 text-center bg-background">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-600" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold">Obrigado, {form.nome.split(' ')[0]}!</p>
          <p className="text-sm text-muted-foreground">Os teus dados foram enviados para {data?.host_nome}.</p>
        </div>
        {data && (
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card px-5 py-4 text-left flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-sm">{data.property?.nome}</span>
            </div>
            <p className="text-xs text-muted-foreground">{fmtDate(data.check_in)} → {fmtDate(data.check_out)}</p>
            <p className="text-xs text-muted-foreground">{n} noite{n !== 1 ? 's' : ''} · {data.num_hospedes} hóspede{data.num_hospedes !== 1 ? 's' : ''}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">O teu anfitrião irá confirmar os detalhes em breve.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-primary px-5 pt-12 pb-6 text-primary-foreground">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-2">Check-in Online</p>
        <h1 className="text-2xl font-bold leading-tight">{data?.property?.nome}</h1>
        <p className="text-sm opacity-80 mt-0.5">{data?.property?.cidade}</p>
        {data && (
          <div className="mt-4 flex items-center gap-2 text-sm opacity-90">
            <span>{fmtDate(data.check_in)}</span>
            <span className="opacity-50">→</span>
            <span>{fmtDate(data.check_out)}</span>
            <span className="opacity-50">·</span>
            <span>{n}n</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col px-4 pt-6 pb-10 gap-6">

        {/* Step: info */}
        {step === 'info' && (
          <>
            <div className="flex flex-col gap-2">
              <p className="font-semibold text-base">Olá! Faz o check-in online</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Fotografa o teu documento de identificação e os dados serão preenchidos automaticamente. Demora menos de 1 minuto.
              </p>
              <p className="text-xs text-muted-foreground">
                Anfitrião: <span className="font-medium text-foreground">{data?.host_nome}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 px-5 py-5 active:bg-primary/10 transition-colors text-left"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Fotografar documento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Passaporte, CC ou BI</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => setStep('review')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 text-center"
              >
                Preencher manualmente
              </button>
            </div>
          </>
        )}

        {/* Step: camera extracting */}
        {step === 'camera' && (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">A ler documento...</p>
          </div>
        )}

        {/* Step: review */}
        {(step === 'review' || extracting) && (
          <>
            {extracting && (
              <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 animate-pulse text-primary shrink-0" />
                A extrair dados do documento...
              </div>
            )}

            {preview && !extracting && (
              <div className="flex flex-col gap-2">
                <img src={preview} alt="Documento" className="w-full rounded-xl object-cover max-h-40" />
                <button
                  type="button"
                  onClick={() => { setPreview(null); setStep('info') }}
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Trocar documento
                </button>
              </div>
            )}

            {extractError && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {extractError}
              </p>
            )}

            {submitError && (
              <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Os teus dados</p>
              {(Object.keys(FIELD_LABELS) as Array<keyof GuestForm>).map(key => {
                const isDate = key === 'data_nascimento' || key === 'data_validade_doc'
                const isSexo = key === 'sexo'
                const isTipoDoc = key === 'tipo_documento'
                const inputClass = "rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full"
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground font-medium">
                      {FIELD_LABELS[key]}
                      {REQUIRED.includes(key) && <span className="text-primary ml-0.5">*</span>}
                    </label>
                    {isTipoDoc ? (
                      <select value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} className={inputClass}>
                        <option value="">Selecionar...</option>
                        <option value="Passaporte">Passaporte</option>
                        <option value="Cartão de Cidadão">Cartão de Cidadão</option>
                        <option value="BI">BI</option>
                        <option value="Título de Residência">Título de Residência</option>
                        <option value="Outro">Outro</option>
                      </select>
                    ) : isSexo ? (
                      <div className="flex gap-3">
                        {[{ val: 'M', label: 'Masculino' }, { val: 'F', label: 'Feminino' }].map(opt => (
                          <label key={opt.val} className={`flex-1 flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm cursor-pointer transition-colors ${
                            form[key] === opt.val ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-input bg-card text-muted-foreground hover:border-primary/40'
                          }`}>
                            <input type="radio" name="sexo" value={opt.val} checked={form[key] === opt.val} onChange={() => setForm(prev => ({ ...prev, [key]: opt.val }))} className="sr-only" />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={isDate ? 'date' : key === 'email' ? 'email' : key === 'telefone' ? 'tel' : 'text'}
                        value={form[key]}
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        className={inputClass}
                        placeholder={isDate ? '' : FIELD_LABELS[key]}
                      />
                    )}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={!form.nome.trim()}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity mt-2"
            >
              Confirmar check-in
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Os teus dados são usados exclusivamente para cumprimento do registo obrigatório de hóspedes (SIBA/SEF).
            </p>
          </>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">A guardar os teus dados...</p>
          </div>
        )}
      </div>
    </div>
  )
}

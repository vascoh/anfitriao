'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Loader2, Home, DoorOpen } from 'lucide-react'
import { toast } from 'sonner'
import { uuid } from '@/lib/utils'
import { fetchProperties } from '@/lib/fetcher'
import type { Property, PropertyType } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'

const PRESET_COLORS = [
  '#C2714F', '#E07B39', '#3D82F6', '#10B981', '#8B5CF6',
  '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316',
]

const AMENITIES = [
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'ar_condicionado', label: 'Ar condicionado' },
  { id: 'estacionamento', label: 'Estacionamento' },
  { id: 'piscina', label: 'Piscina' },
  { id: 'cozinha', label: 'Cozinha equipada' },
  { id: 'maquina_lavar', label: 'Máquina lavar' },
  { id: 'secador', label: 'Secador' },
  { id: 'tv', label: 'TV' },
  { id: 'varanda', label: 'Varanda' },
  { id: 'jardim', label: 'Jardim' },
]

const TYPES: PropertyType[] = ['apartamento', 'moradia', 'quarto', 'outro']

function NovaPropriedadeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /* A escolha «alojamento inteiro ou quarto» era implícita: vinha de um
   * `?parent=` no URL, posto por um link que só existia em casas que já
   * tinham quartos. Quem abrisse «Nova» pelo botão normal nunca via a
   * pergunta — e ficava sem saber que o conceito existia. Agora é a primeira
   * coisa que se decide, por palavras, no ecrã. */
  const [modo, setModo] = useState<'inteiro' | 'quarto'>(
    searchParams.get('parent') ? 'quarto' : 'inteiro',
  )
  const [parentEscolhido, setParentEscolhido] = useState<string | null>(
    searchParams.get('parent'),
  )
  const [casas, setCasas] = useState<Property[]>([])

  useEffect(() => {
    fetchProperties()
      .then(todas => setCasas(todas.filter(x => !x.parent_id)))
      .catch(() => setCasas([]))
  }, [])

  const parentId = modo === 'quarto' ? (parentEscolhido ?? undefined) : undefined
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PropertyType>('apartamento')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [quartos, setQuartos] = useState(1)
  const [casasBanho, setCasasBanho] = useState(1)
  const [capacidade, setCapacidade] = useState(2)
  const [precoBase, setPrecoBase] = useState(80)
  const [taxaLimpeza, setTaxaLimpeza] = useState(0)
  const [cor, setCor] = useState(PRESET_COLORS[0])
  const [comodidades, setComodidades] = useState<string[]>(['wifi', 'cozinha'])
  const [instrucoesCheckin, setInstrucoesCheckin] = useState('')
  const [regrasCasa, setRegrasCasa] = useState('')
  const [uploadingPrincipal, setUploadingPrincipal] = useState(false)

  function toggleAmenity(id: string) {
    setComodidades(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const [saving, setSaving] = useState(false)

  async function handleUploadPrincipal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingPrincipal(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Erro ao carregar o ficheiro')
      setImagemUrl(json.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o ficheiro')
    } finally {
      setUploadingPrincipal(false)
    }
  }

  async function handleSave() {
    if (!nome.trim() || !cidade.trim()) return
    setSaving(true)
    try {
      const p: Property = {
        id: uuid(),
        nome: nome.trim(),
        tipo,
        endereco: endereco.trim(),
        cidade: cidade.trim(),
        descricao: descricao.trim() || undefined,
        imagem_url: imagemUrl.trim() || undefined,
        quartos,
        casasBanho,
        capacidade,
        preco_base: precoBase,
        taxa_limpeza: taxaLimpeza || undefined,
        cor,
        comodidades,
        instrucoes_checkin: instrucoesCheckin.trim(),
        regras_casa: regrasCasa.trim(),
        ativo: true,
        criado_em: new Date().toISOString(),
        parent_id: parentId ?? null,
      }

      // Usa a API server-side que verifica o limite do plano e adiciona owner_id
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string; code?: string }
        if (err.code === 'LIMIT_REACHED') {
          toast.error(err.error ?? 'Limite de propriedades atingido.', {
            action: { label: 'Fazer upgrade', onClick: () => router.push('/conta/billing') },
            duration: 6000,
          })
        } else {
          toast.error(err.error ?? 'Erro ao criar propriedade. Tenta novamente.')
        }
        setSaving(false)
        return
      }

      toast.success(parentId ? 'Quarto adicionado com sucesso' : 'Propriedade criada com sucesso')
      router.push(parentId ? `/propriedades/${parentId}` : `/propriedades/${p.id}`)
    } catch {
      toast.error('Erro ao criar propriedade. Tenta novamente.')
      setSaving(false)
    }
  }

  /* Escolher «quarto» e não dizer de que casa deixaria o quarto a alugar-se
   * sozinho — exactamente o engano que este ecrã passou a existir para evitar. */
  const canSave = nome.trim() && cidade.trim() && (modo === 'inteiro' || !!parentEscolhido)

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Link href={parentId ? `/propriedades/${parentId}` : '/propriedades'} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold">{parentId ? 'Novo quarto' : 'Nova propriedade'}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4 pb-8">
        {/* A primeira pergunta, e a única que muda o resto. */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            O que estás a criar?
          </p>

          <button
            type="button"
            onClick={() => { setModo('inteiro'); setParentEscolhido(null) }}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
              modo === 'inteiro' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <Home className={`h-5 w-5 shrink-0 mt-0.5 ${modo === 'inteiro' ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">Um alojamento inteiro</span>
              <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Aluga-se todo de uma vez, a um só grupo. Uma reserva ocupa a casa toda.
                É o caso de um apartamento ou de uma moradia.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setModo('quarto')}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
              modo === 'quarto' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <DoorOpen className={`h-5 w-5 shrink-0 mt-0.5 ${modo === 'quarto' ? 'text-primary' : 'text-muted-foreground'}`} aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">Um quarto dentro de uma casa</span>
              <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Cada quarto aluga-se em separado, a hóspedes diferentes ao mesmo tempo.
                A casa em si deixa de se alugar por inteiro.
              </span>
            </span>
          </button>

          {modo === 'quarto' && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3.5">
              <label htmlFor="casa-mae" className="text-xs font-semibold">
                De que casa faz parte este quarto?
              </label>
              {casas.length === 0 ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ainda não tens nenhuma casa criada. Cria primeiro o alojamento principal
                  (por exemplo, «Casa de Vasco») como <strong>alojamento inteiro</strong>,
                  e depois volta aqui para lhe acrescentar os quartos.
                </p>
              ) : (
                <>
                  <select
                    id="casa-mae"
                    value={parentEscolhido ?? ''}
                    onChange={e => setParentEscolhido(e.target.value || null)}
                    className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Escolhe a casa…</option>
                    {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  {!parentEscolhido && (
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Escolhe a casa antes de continuar — sem isso, este quarto fica a alugar-se sozinho.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {/* Basic info */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Informação básica</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Apartamento Alfama"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    tipo === t ? 'border-primary bg-primary/5 text-primary' : 'border-input bg-card text-foreground/70'
                  }`}>
                  {PROPERTY_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Morada</label>
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Cidade *</label>
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: Lisboa"
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição pública</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Breve descrição para o website de reservas..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Foto principal</label>
            <div className="flex items-center gap-2">
              <input type="url" value={imagemUrl} onChange={e => setImagemUrl(e.target.value)}
                placeholder="https://... ou carrega um ficheiro"
                className="flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <label className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                {uploadingPrincipal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                  disabled={uploadingPrincipal} onChange={handleUploadPrincipal} />
              </label>
            </div>
            {imagemUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- URL arbitrário/preview local, fora do next/image
              <img src={imagemUrl} alt="Preview" className="rounded-lg h-32 w-full object-cover mt-1" />
            )}
          </div>
        </div>

        {/* Capacity */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Capacidade</p>
          {[
            { label: 'Quartos', value: quartos, set: setQuartos, min: 0, max: 20 },
            { label: 'Casas de banho', value: casasBanho, set: setCasasBanho, min: 1, max: 10 },
            { label: 'Máx. hóspedes', value: capacidade, set: setCapacidade, min: 1, max: 30 },
          ].map(f => (
            <div key={f.label} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm font-medium">{f.label}</span>
              <div className="flex items-center gap-4">
                <button onClick={() => f.set(Math.max(f.min, f.value - 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  −
                </button>
                <span className="text-sm font-semibold w-5 text-center">{f.value}</span>
                <button onClick={() => f.set(Math.min(f.max, f.value + 1))}
                  className="h-8 w-8 rounded-full border border-border flex items-center justify-center text-lg font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Preço</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Preço base por noite (€)</label>
              <input type="number" value={precoBase} onChange={e => setPrecoBase(Number(e.target.value))} min={1}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">Taxa de limpeza (€)</label>
              <input type="number" value={taxaLimpeza} onChange={e => setTaxaLimpeza(Number(e.target.value))} min={0}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        </div>

        {/* Color */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cor de identificação</p>
          <div className="flex gap-2.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setCor(c)}
                className={`h-8 w-8 rounded-full transition-transform ${cor === c ? 'scale-125 ring-2 ring-offset-2 ring-primary' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        {/* Amenities */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comodidades</p>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map(a => (
              <button key={a.id} onClick={() => toggleAmenity(a.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  comodidades.includes(a.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground/70 border-input'
                }`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Check-in instructions */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Operacional</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Instruções de check-in</label>
            <textarea value={instrucoesCheckin} onChange={e => setInstrucoesCheckin(e.target.value)}
              placeholder="Código da fechadura, localização das chaves, instruções especiais..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-28 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Regras da casa</label>
            <textarea value={regrasCasa} onChange={e => setRegrasCasa(e.target.value)}
              placeholder="Sem festas, sem animais, silêncio após 23h..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-24 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <button onClick={handleSave} disabled={!canSave || saving}
          className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity mt-2">
          {saving ? 'A criar...' : parentId ? 'Criar quarto' : 'Criar propriedade'}
        </button>
      </div>
    </div>
  )
}

export default function NovaPropriedadePage() {
  return (
    <Suspense>
      <NovaPropriedadeForm />
    </Suspense>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft, ArrowRight, Plus, Trash2, Rss, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { fetchProperties } from '@/lib/fetcher'
import type { Property, PropertyType, IcalFeed } from '@/lib/types'
import { PROPERTY_TYPE_LABEL } from '@/lib/labels'
import { guardar } from '@/lib/guardar'

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

export default function EditarPropriedadePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useUser()
  const ownerId = user?.id
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)
  /* A lista toda serve para saber que casas podem receber este alojamento como
   * quarto — e para saber se ele próprio já tem quartos. */
  const [todas, setTodas] = useState<Property[]>([])
  const [parentId, setParentId] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PropertyType>('apartamento')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [mostrarMoradaPublica, setMostrarMoradaPublica] = useState(false)
  const [descricao, setDescricao] = useState('')
  const [imagemUrl, setImagemUrl] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [uploadingPrincipal, setUploadingPrincipal] = useState(false)
  const [uploadingFotoIdx, setUploadingFotoIdx] = useState<number | null>(null)
  const [quartos, setQuartos] = useState(1)
  const [casasBanho, setCasasBanho] = useState(1)
  const [capacidade, setCapacidade] = useState(2)
  const [precoBase, setPrecoBase] = useState(80)
  const [taxaLimpeza, setTaxaLimpeza] = useState(0)
  const [cor, setCor] = useState(PRESET_COLORS[0])
  const [comodidades, setComodidades] = useState<string[]>([])
  const [instrucoesCheckin, setInstrucoesCheckin] = useState('')
  const [regrasCasa, setRegrasCasa] = useState('')
  const [icalFeeds, setIcalFeeds] = useState<IcalFeed[]>([])

  useEffect(() => {
    if (!ownerId) return
    fetchProperties().then(all => {
      setTodas(all)
      const p = all.find(x => x.id === id)
      if (!p) { router.push('/propriedades'); return }
      setProp(p)
      setNome(p.nome)
      setTipo(p.tipo)
      setEndereco(p.endereco)
      setCidade(p.cidade)
      setMostrarMoradaPublica(p.mostrar_morada_publica ?? false)
      setQuartos(p.quartos)
      setCasasBanho(p.casasBanho)
      setCapacidade(p.capacidade)
      setPrecoBase(p.preco_base)
      setTaxaLimpeza(p.taxa_limpeza ?? 0)
      setCor(p.cor)
      setComodidades(p.comodidades)
      setDescricao(p.descricao ?? '')
      setImagemUrl(p.imagem_url ?? '')
      setFotos(p.fotos ?? [])
      setInstrucoesCheckin(p.instrucoes_checkin)
      setRegrasCasa(p.regras_casa)
      setIcalFeeds(p.ical_feeds ?? [])
      setParentId(p.parent_id ?? null)
    })
  }, [id, router, ownerId])

  async function uploadFoto(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? 'Erro ao carregar o ficheiro')
    }
    return json.url
  }

  async function handleUploadPrincipal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingPrincipal(true)
    try {
      setImagemUrl(await uploadFoto(file))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o ficheiro')
    } finally {
      setUploadingPrincipal(false)
    }
  }

  async function handleUploadFoto(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingFotoIdx(i)
    try {
      const url = await uploadFoto(file)
      setFotos(prev => prev.map((u, j) => j === i ? url : u))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar o ficheiro')
    } finally {
      setUploadingFotoIdx(null)
    }
  }

  function toggleAmenity(aid: string) {
    setComodidades(prev => prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid])
  }

  async function handleSave() {
    if (!prop || !nome.trim() || !cidade.trim()) return
    try {
      const updated: Property = {
        ...prop,
        nome: nome.trim(),
        tipo,
        endereco: endereco.trim(),
        cidade: cidade.trim(),
        descricao: descricao.trim() || undefined,
        imagem_url: imagemUrl.trim() || undefined,
        fotos,
        mostrar_morada_publica: mostrarMoradaPublica,
        quartos,
        casasBanho,
        capacidade,
        preco_base: precoBase,
        taxa_limpeza: taxaLimpeza || undefined,
        cor,
        comodidades,
        instrucoes_checkin: instrucoesCheckin.trim(),
        regras_casa: regrasCasa.trim(),
        ical_feeds: icalFeeds,
        parent_id: parentId,
      }
      /* Verificava o `ok` — e deitava fora o motivo. O servidor sabe dizer
       * "limite do plano atingido (3/3 alojamentos)"; o ecrã respondia "Erro
       * ao guardar. Tenta novamente.", que manda a pessoa repetir uma coisa
       * que vai falhar exatamente da mesma maneira. */
      if (!await guardar('/api/properties', updated)) return
      toast.success('Propriedade atualizada')
      router.push(`/propriedades/${id}`)
    } catch {
      toast.error('Erro ao guardar. Tenta novamente.')
    }
  }

  if (!prop) return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="h-1 w-full bg-muted" />
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/propriedades/${id}`} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="h-4 w-36 bg-muted rounded animate-pulse" />
        </div>
      </header>
    </div>
  )

  const canSave = nome.trim() && cidade.trim()

  /* Quem pode receber este alojamento como quarto: casas de topo, sem contar
   * com ele próprio. As mesmas três regras que o servidor impõe — aqui só para
   * não se oferecer o que vai ser recusado. */
  const quartosFilhos = todas.filter(x => x.parent_id === id)
  const temQuartos = quartosFilhos.length > 0
  const casasPossiveis = todas.filter(x => x.id !== id && !x.parent_id)

  return (
    <div className="flex flex-col min-h-full">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="h-1 w-full" style={{ backgroundColor: cor }} />
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href={`/propriedades/${id}`} className="p-1 -ml-1 rounded-lg text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-base font-semibold flex-1 truncate">Editar — {prop.nome}</h1>
        </div>
      </header>

      <div className="flex flex-col gap-5 p-4 pb-8">
        {/* Basic info */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Informação básica</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Nome *</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)}
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
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Cidade *</label>
            <input type="text" value={cidade} onChange={e => setCidade(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="button" onClick={() => setMostrarMoradaPublica(v => !v)}
            className="flex items-center gap-3 rounded-lg border border-input bg-card px-3 py-3 text-left">
            <div className="flex-1">
              <p className="text-sm font-medium">Mostrar morada completa no site público</p>
              <p className="text-xs text-muted-foreground">
                {mostrarMoradaPublica
                  ? 'A página "Localização" mostra a morada exata a qualquer visitante.'
                  : 'A página "Localização" mostra só a cidade; a morada exata fica para depois da reserva confirmada.'}
              </p>
            </div>
            <span className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${mostrarMoradaPublica ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${mostrarMoradaPublica ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </span>
          </button>
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

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">Mais fotos (galeria do site)</label>
              <button type="button" onClick={() => setFotos(prev => [...prev, ''])}
                className="text-xs text-primary font-semibold flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            </div>
            {fotos.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="url" value={url} placeholder="https://... ou carrega um ficheiro"
                  onChange={e => setFotos(prev => prev.map((u, j) => j === i ? e.target.value : u))}
                  className="flex-1 rounded-lg border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <label className="shrink-0 flex items-center justify-center h-10 w-10 rounded-lg border border-input bg-card text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                  {uploadingFotoIdx === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
                    disabled={uploadingFotoIdx !== null} onChange={e => handleUploadFoto(i, e)} />
                </label>
                <button type="button" onClick={() => setFotos(prev => prev.filter((_, j) => j !== i))}
                  className="p-2 text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
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

        {/* Instructions */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Operacional</p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Instruções de check-in</label>
            <textarea value={instrucoesCheckin} onChange={e => setInstrucoesCheckin(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-28 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Regras da casa</label>
            <textarea value={regrasCasa} onChange={e => setRegrasCasa(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none min-h-24 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {/* Canais — a gestão vive em /canais.
          *
          * Havia três sítios a fazer isto: aqui, em /website e agora em
          * /canais. Nenhum dos dois primeiros explicava o que é um iCal, nem
          * validava o endereço, nem mostrava se a ligação estava viva — e este
          * ainda perdia o feed se o anfitrião saísse sem carregar em «Guardar
          * alterações» no fim de um formulário de trinta campos. Passa a haver
          * um sítio só, e é o que ensina. */}
        {/* Faz parte de uma casa?
          *
          * `parent_id` existia no modelo, na base e em metade da lógica — mas
          * só se conseguia definir no momento da criação, e só através de um
          * `?parent=` no URL que aparecia num link escondido dentro de casas
          * que **já tinham** quartos. Quem criasse a casa e os quartos pela
          * ordem natural ficava com tudo à solta e sem forma de o arrumar.
          * Este seletor é a forma de o corrigir depois do facto. */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Faz parte de uma casa?</p>
          {temQuartos ? (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Este alojamento é uma casa com {quartosFilhos.length} {quartosFilhos.length === 1 ? 'quarto' : 'quartos'}.
              Uma casa com quartos não pode ser, ela própria, quarto de outra.
            </p>
          ) : (
            <>
              <select
                value={parentId ?? ''}
                onChange={e => setParentId(e.target.value || null)}
                className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Não — é um alojamento independente</option>
                {casasPossiveis.map(c => (
                  <option key={c.id} value={c.id}>Sim, é um quarto de: {c.nome}</option>
                ))}
              </select>

              {casasPossiveis.length === 0 && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ainda não tens nenhuma casa a que este quarto possa pertencer.
                  Cria primeiro o alojamento principal e volta aqui.
                </p>
              )}

              {parentId && !prop.parent_id && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
                  Ao guardar, este alojamento passa a ser um quarto de{' '}
                  <strong>{casasPossiveis.find(c => c.id === parentId)?.nome}</strong>.
                  A casa deixa de se alugar por inteiro — passa a alugar-se quarto a quarto,
                  e o calendário dela mostra a ocupação de todos os quartos juntos.
                  As reservas que este alojamento já tem não se perdem.
                </p>
              )}

              {!parentId && prop.parent_id && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 leading-relaxed">
                  Ao guardar, este quarto deixa de pertencer à casa e passa a alugar-se sozinho.
                  Se a casa ficar sem quartos nenhuns, volta a alugar-se por inteiro.
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Canais e calendários</p>
          <Link
            href="/canais"
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/40 transition-colors"
          >
            <Rss className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Ligar ao Airbnb e ao Booking.com</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {(icalFeeds.length > 0)
                  ? `${icalFeeds.length} ${icalFeeds.length === 1 ? 'canal ligado' : 'canais ligados'} · ver estado e sincronizar`
                  : 'Importar reservas das plataformas e bloquear lá as datas ocupadas aqui'}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
          </Link>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!canSave}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity">
            Guardar alterações
          </button>
          <Link href={`/propriedades/${id}`}
            className="flex-1 rounded-xl py-3.5 font-semibold text-sm border border-border text-foreground text-center">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}

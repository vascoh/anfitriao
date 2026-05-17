'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { store } from '@/lib/store'
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

export default function EditarPropriedadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [prop, setProp] = useState<Property | null>(null)

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<PropertyType>('apartamento')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [descricao, setDescricao] = useState('')
  const [quartos, setQuartos] = useState(1)
  const [casasBanho, setCasasBanho] = useState(1)
  const [capacidade, setCapacidade] = useState(2)
  const [precoBase, setPrecoBase] = useState(80)
  const [cor, setCor] = useState(PRESET_COLORS[0])
  const [comodidades, setComodidades] = useState<string[]>([])
  const [instrucoesCheckin, setInstrucoesCheckin] = useState('')
  const [regrasCasa, setRegrasCasa] = useState('')

  useEffect(() => {
    const p = store.getProperties().find(x => x.id === id)
    if (!p) { router.push('/propriedades'); return }
    setProp(p)
    setNome(p.nome)
    setTipo(p.tipo)
    setEndereco(p.endereco)
    setCidade(p.cidade)
    setQuartos(p.quartos)
    setCasasBanho(p.casasBanho)
    setCapacidade(p.capacidade)
    setPrecoBase(p.preco_base)
    setCor(p.cor)
    setComodidades(p.comodidades)
    setDescricao(p.descricao ?? '')
    setInstrucoesCheckin(p.instrucoes_checkin)
    setRegrasCasa(p.regras_casa)
  }, [id, router])

  function toggleAmenity(aid: string) {
    setComodidades(prev => prev.includes(aid) ? prev.filter(x => x !== aid) : [...prev, aid])
  }

  function handleSave() {
    if (!prop || !nome.trim() || !cidade.trim()) return
    const updated: Property = {
      ...prop,
      nome: nome.trim(),
      tipo,
      endereco: endereco.trim(),
      cidade: cidade.trim(),
      descricao: descricao.trim() || undefined,
      quartos,
      casasBanho,
      capacidade,
      preco_base: precoBase,
      cor,
      comodidades,
      instrucoes_checkin: instrucoesCheckin.trim(),
      regras_casa: regrasCasa.trim(),
    }
    store.saveProperty(updated)
    router.push(`/propriedades/${id}`)
  }

  if (!prop) return null

  const canSave = nome.trim() && cidade.trim()

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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Descrição pública</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              placeholder="Breve descrição para o website de reservas..."
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground font-medium">Preço base por noite (€)</label>
            <input type="number" value={precoBase} onChange={e => setPrecoBase(Number(e.target.value))} min={1}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
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

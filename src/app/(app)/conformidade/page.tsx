'use client'

import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { ShieldCheck, ShieldAlert, Clock, Circle, ExternalLink, Printer, BarChart3, Coins } from 'lucide-react'
import Link from 'next/link'
import { fetchProperties } from '@/lib/fetcher'
import { abreviaturaDe } from '@/lib/siba-mapping'
import { today, fmtDate } from '@/lib/utils'
import {
  avaliarConformidade,
  resumirConformidade,
  ordenarPorGravidade,
  type EstadoItem,
  type ItemConformidade,
} from '@/lib/compliance'
import type { Property } from '@/lib/types'

/** Portal oficial do Livro de Reclamações Eletrónico. */
const URL_LRE = 'https://www.livroreclamacoes.pt/inicio'

const ESTILO: Record<EstadoItem, { Icon: typeof ShieldCheck; classe: string; rotulo: string }> = {
  ok: { Icon: ShieldCheck, classe: 'text-emerald-600 dark:text-emerald-400', rotulo: 'Em dia' },
  a_expirar: { Icon: Clock, classe: 'text-amber-600 dark:text-amber-400', rotulo: 'A expirar' },
  expirado: { Icon: ShieldAlert, classe: 'text-red-600 dark:text-red-400', rotulo: 'Expirado' },
  em_falta: { Icon: Circle, classe: 'text-muted-foreground', rotulo: 'Em falta' },
}

function Semaforo({ estado }: { estado: EstadoItem }) {
  const { Icon, classe, rotulo } = ESTILO[estado]
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${classe}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {rotulo}
    </span>
  )
}

function Campo({
  label, value, onChange, type = 'text', placeholder, hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'date'
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

type Rascunho = {
  rnal_numero: string
  rnal_data: string
  seguro_seguradora: string
  seguro_apolice: string
  seguro_validade: string
  certificado_energetico_validade: string
  livro_reclamacoes_registado: boolean
  siba_nipc: string
  siba_estabelecimento: string
  siba_abreviatura: string
  siba_codigo_postal: string
  siba_telefone: string
  siba_nome_contacto: string
  siba_email_contacto: string
  /** Vazio = não mexer na que está guardada. Nunca vem preenchido do servidor. */
  siba_chave_acesso: string
}

function paraRascunho(p: Property): Rascunho {
  return {
    rnal_numero: p.rnal_numero ?? '',
    rnal_data: p.rnal_data ?? '',
    seguro_seguradora: p.seguro_seguradora ?? '',
    seguro_apolice: p.seguro_apolice ?? '',
    seguro_validade: p.seguro_validade ?? '',
    certificado_energetico_validade: p.certificado_energetico_validade ?? '',
    livro_reclamacoes_registado: p.livro_reclamacoes_registado ?? false,
    siba_nipc: p.siba_nipc ?? '',
    siba_estabelecimento: p.siba_estabelecimento ?? '',
    siba_abreviatura: p.siba_abreviatura ?? '',
    siba_codigo_postal: p.siba_codigo_postal ?? '',
    siba_telefone: p.siba_telefone ?? '',
    siba_nome_contacto: p.siba_nome_contacto ?? '',
    siba_email_contacto: p.siba_email_contacto ?? '',
    siba_chave_acesso: '',
  }
}

export default function ConformidadePage() {
  const { user } = useUser()
  const ownerId = user?.id
  const [propriedades, setPropriedades] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [saving, setSaving] = useState(false)

  const hoje = today()

  useEffect(() => {
    if (!ownerId) return
    fetchProperties().then(p => {
      setPropriedades(p.filter(x => x.ativo !== false))
      setLoading(false)
    })
  }, [ownerId])

  const porPropriedade = useMemo(
    () => propriedades.map(p => {
      const itens = ordenarPorGravidade(avaliarConformidade(p, hoje))
      return { propriedade: p, itens, resumo: resumirConformidade(itens) }
    }),
    [propriedades, hoje],
  )

  const totalCriticos = porPropriedade.reduce((s, x) => s + x.resumo.criticos, 0)
  const totalAExpirar = porPropriedade.reduce((s, x) => s + x.resumo.aExpirar, 0)

  function abrir(p: Property) {
    if (aberto === p.id) { setAberto(null); return }
    setAberto(p.id)
    setRascunho(paraRascunho(p))
  }

  async function guardar(propertyId: string) {
    if (!rascunho) return
    setSaving(true)
    try {
      const res = await fetch('/api/compliance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, ...rascunho }),
      })
      if (!res.ok) throw new Error()
      const atualizada: Property = await res.json()
      setPropriedades(prev => prev.map(p => (p.id === propertyId ? { ...p, ...atualizada } : p)))
      setAberto(null)
      toast.success('Conformidade atualizada')
    } catch {
      toast.error('Não foi possível guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
        {[0, 1].map(i => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conformidade</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            As obrigações legais de cada alojamento, num sítio só. Avisamos-te antes de expirarem.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/conformidade/taxa-turistica"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <Coins className="h-4 w-4" aria-hidden="true" />
            Taxa turística
          </Link>
          <Link
            href="/conformidade/ine"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
          >
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
            Inquérito do INE
          </Link>
        </div>
      </header>

      {/* Resumo */}
      {propriedades.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-2xl font-bold">{propriedades.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">Alojamentos</div>
          </div>
          <div className={`rounded-2xl border p-4 ${totalCriticos > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card'}`}>
            <div className={`text-2xl font-bold ${totalCriticos > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
              {totalCriticos}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">Em falta ou expirados</div>
          </div>
          <div className={`rounded-2xl border p-4 ${totalAExpirar > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-card'}`}>
            <div className={`text-2xl font-bold ${totalAExpirar > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
              {totalAExpirar}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">A expirar em 30 dias</div>
          </div>
        </div>
      )}

      {propriedades.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Ainda não tens alojamentos.</p>
          <Link
            href="/propriedades/nova"
            className="mt-4 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Adicionar alojamento
          </Link>
        </div>
      )}

      {porPropriedade.map(({ propriedade: p, itens, resumo }) => (
        <section key={p.id} className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div>
              <h2 className="font-bold">{p.nome}</h2>
              <p className="text-xs text-muted-foreground">{p.cidade}</p>
            </div>
            <div className="flex items-center gap-3">
              {resumo.pendentes === 0 ? (
                <Semaforo estado="ok" />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">
                  {resumo.pendentes} {resumo.pendentes === 1 ? 'pendência' : 'pendências'}
                </span>
              )}
              <button
                type="button"
                onClick={() => abrir(p)}
                className="min-h-11 rounded-lg border border-border px-4 text-sm font-semibold transition-colors hover:bg-muted"
              >
                {aberto === p.id ? 'Fechar' : 'Editar'}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-border">
            {itens.map(item => (
              <li key={item.chave} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.titulo}</span>
                    {!item.obrigatorio && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Facultativo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detalhe}</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">{item.base}</p>
                  <AccaoItem item={item} propertyId={p.id} />
                </div>
                <Semaforo estado={item.estado} />
              </li>
            ))}
          </ul>

          {aberto === p.id && rascunho && (
            <div className="border-t border-border bg-muted/30 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  label="Número de registo (RNAL)"
                  value={rascunho.rnal_numero}
                  onChange={v => setRascunho({ ...rascunho, rnal_numero: v })}
                  placeholder="12345/AL"
                />
                <Campo
                  label="Data de registo"
                  type="date"
                  value={rascunho.rnal_data}
                  onChange={v => setRascunho({ ...rascunho, rnal_data: v })}
                />
                <Campo
                  label="Seguradora"
                  value={rascunho.seguro_seguradora}
                  onChange={v => setRascunho({ ...rascunho, seguro_seguradora: v })}
                  placeholder="Fidelidade"
                />
                <Campo
                  label="Número da apólice"
                  value={rascunho.seguro_apolice}
                  onChange={v => setRascunho({ ...rascunho, seguro_apolice: v })}
                />
                <Campo
                  label="Validade do seguro"
                  type="date"
                  value={rascunho.seguro_validade}
                  onChange={v => setRascunho({ ...rascunho, seguro_validade: v })}
                  hint="Avisamos-te 30 dias antes."
                />
                <Campo
                  label="Validade do certificado energético"
                  type="date"
                  value={rascunho.certificado_energetico_validade}
                  onChange={v => setRascunho({ ...rascunho, certificado_energetico_validade: v })}
                />
              </div>

              {/* Registo no web service do SIBA — o que permite entregar os
                  boletins sem abrir o portal. As credenciais são do anfitrião,
                  por estabelecimento; pedem-se na área reservada do portal. */}
              <details className="mt-4 rounded-xl border border-border bg-background">
                <summary className="cursor-pointer list-none p-4 text-sm font-semibold">
                  <span className="flex items-center justify-between gap-3">
                    <span>Entrega automática de boletins (SIBA)</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {p.siba_nipc && p.siba_chave_definida ? 'Ligado' : 'Por configurar'}
                    </span>
                  </span>
                </summary>

                <div className="border-t border-border p-4">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Para entregarmos os boletins por ti, o alojamento tem de estar registado no
                    portal do SIBA com o modo de envio <strong>Web Service</strong>. Depois de o
                    pedires, a AIMA envia por email o número de estabelecimento e a chave de
                    acesso — costuma demorar 1 a 3 dias úteis.
                  </p>
                  <a
                    href="https://siba.ssi.gov.pt/s"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Abrir a área reservada do SIBA
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Campo
                      label="NIPC / NIF da unidade"
                      value={rascunho.siba_nipc}
                      onChange={v => setRascunho({ ...rascunho, siba_nipc: v })}
                      placeholder="123456789"
                    />
                    <Campo
                      label="Número de estabelecimento"
                      value={rascunho.siba_estabelecimento}
                      onChange={v => setRascunho({ ...rascunho, siba_estabelecimento: v })}
                      placeholder="00"
                      hint="O primeiro alojamento de um NIF é o 00."
                    />
                    <Campo
                      label="Chave de acesso"
                      value={rascunho.siba_chave_acesso}
                      onChange={v => setRascunho({ ...rascunho, siba_chave_acesso: v })}
                      placeholder={p.siba_chave_definida ? 'Guardada — escreve para substituir' : 'Só dígitos'}
                      hint="Guardada encriptada. Nunca a mostramos outra vez."
                    />
                    <Campo
                      label="Código postal"
                      value={rascunho.siba_codigo_postal}
                      onChange={v => setRascunho({ ...rascunho, siba_codigo_postal: v })}
                      placeholder="4050-175"
                    />
                    <Campo
                      label="Telefone"
                      value={rascunho.siba_telefone}
                      onChange={v => setRascunho({ ...rascunho, siba_telefone: v })}
                    />
                    <Campo
                      label="Abreviatura"
                      value={rascunho.siba_abreviatura}
                      onChange={v => setRascunho({ ...rascunho, siba_abreviatura: v })}
                      placeholder={abreviaturaDe(p.nome)}
                      hint="Até 3 letras. Se deixares vazio, usamos as iniciais."
                    />
                    <Campo
                      label="Nome de contacto"
                      value={rascunho.siba_nome_contacto}
                      onChange={v => setRascunho({ ...rascunho, siba_nome_contacto: v })}
                    />
                    <Campo
                      label="Email de contacto"
                      value={rascunho.siba_email_contacto}
                      onChange={v => setRascunho({ ...rascunho, siba_email_contacto: v })}
                    />
                  </div>
                </div>
              </details>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-background p-4">
                <input
                  type="checkbox"
                  checked={rascunho.livro_reclamacoes_registado}
                  onChange={e => setRascunho({ ...rascunho, livro_reclamacoes_registado: e.target.checked })}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]"
                />
                <span className="text-sm">
                  <span className="font-semibold">Já registei este alojamento no Livro de Reclamações Eletrónico</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    O registo é gratuito e obrigatório. O aviso com o acesso tem de estar afixado no alojamento.
                  </span>
                </span>
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => guardar(p.id)}
                  className="min-h-11 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? 'A guardar…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setAberto(null)}
                  className="min-h-11 rounded-lg border border-border px-6 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
      ))}

      {propriedades.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Esta página organiza obrigações legais e avisa-te de prazos. Não substitui aconselhamento
          jurídico nem contabilístico — em caso de dúvida, confirma com o teu contabilista.
        </p>
      )}
    </div>
  )
}

/** Ação contextual por item: o que o anfitrião pode fazer a seguir. */
function AccaoItem({ item, propertyId }: { item: ItemConformidade; propertyId: string }) {
  if (item.chave === 'livro_reclamacoes') {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {item.estado !== 'ok' && (
          <a
            href={URL_LRE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
          >
            Registar no portal oficial
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
        <Link
          href={`/conformidade/cartaz/${propertyId}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
        >
          <Printer className="h-3 w-3" aria-hidden="true" />
          Imprimir aviso para afixar
        </Link>
      </div>
    )
  }

  if (item.validade && item.estado !== 'ok') {
    return (
      <p className="mt-2 text-xs font-medium text-muted-foreground">
        Validade: {fmtDate(item.validade, { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    )
  }

  return null
}

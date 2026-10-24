'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Loader2 } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import { fetchProperties, fetchSettings } from '@/lib/fetcher'
import type { Property, WebsiteSettings } from '@/lib/types'
import { faltaNoAlojamento as emFalta, fotosDe } from '@/lib/site-alojamentos'
import { ErroAoCarregar } from '@/components/erro-ao-carregar'
import { EditorAlojamento } from './_components/editor-alojamento'

export default function FotosEQuartosPage() {
  const { user } = useUser()
  const [props, setProps] = useState<Property[] | null>(null)
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [erro, setErro] = useState(false)
  const [escolhido, setEscolhido] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setErro(false)
    Promise.all([fetchProperties({ exigirSucesso: true }), fetchSettings()])
      .then(([p, s]) => { setProps(p); setSettings(s) })
      .catch(() => setErro(true))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const t = setTimeout(carregar, 0)
    return () => clearTimeout(t)
  }, [user?.id, carregar])

  /* Casa primeiro, os quartos logo a seguir — a ordem em que aparecem no site. */
  const lista = useMemo(() => {
    const ativas = (props ?? []).filter(p => p.ativo)
    return ativas.filter(p => !p.parent_id).flatMap(c => [c, ...ativas.filter(q => q.parent_id === c.id)])
  }, [props])

  const atual = lista.find(p => p.id === escolhido) ?? lista[0] ?? null
  const casaDe = (p: Property) => (p.parent_id ? lista.find(c => c.id === p.parent_id) ?? null : null)
  const prontos = lista.filter(p => emFalta(p).length === 0).length

  const aoGuardar = useCallback((linha: Partial<Property> & { id: string }) => {
    setProps(l => l?.map(p => (p.id === linha.id ? { ...p, ...linha } : p)) ?? l)
  }, [])

  if (erro) return <ErroAoCarregar oQue="os alojamentos" aoTentar={carregar} />

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-28 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/website" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Site de reservas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Fotos e quartos</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            O que os hóspedes veem em cada alojamento do site. Fica tudo guardado à medida que mudas.
          </p>
        </div>
        {settings?.slug && (
          <a href={`/r/${settings.slug}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-input px-3.5 py-2 text-sm font-medium hover:bg-muted">
            <ExternalLink className="h-4 w-4" /> Abrir o site
          </a>
        )}
      </div>

      {props === null ? (
        <div className="flex justify-center rounded-2xl border border-border p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Ainda não há alojamentos ativos.</p>
          <p className="text-sm text-muted-foreground">Cria o primeiro e volta aqui para lhe juntar fotografias.</p>
          <Link href="/propriedades/nova" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Criar alojamento</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <nav aria-label="Alojamentos" className="flex flex-col gap-2">
            <p className="px-1 text-xs text-muted-foreground">{prontos} de {lista.length} prontos para o site</p>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
              {lista.map(p => {
                const capa = fotosDe(p)[0]
                const falta = emFalta(p)
                const ativo = atual?.id === p.id
                return (
                  <li key={p.id} className="shrink-0 lg:shrink">
                    <button type="button" onClick={() => setEscolhido(p.id)} aria-current={ativo || undefined}
                      className={`flex w-60 items-center gap-3 rounded-xl border p-2 text-left transition-colors lg:w-full ${
                        ativo ? 'border-primary/40 bg-primary/5' : 'border-transparent hover:bg-muted'} ${p.parent_id ? 'lg:ml-4 lg:w-[calc(100%-1rem)]' : ''}`}>
                      <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg" style={{ backgroundColor: `${p.cor}26` }}>
                        {capa && <Image src={capa} alt="" fill sizes="56px" className="object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.nome}</span>
                        <span className={`flex items-center gap-1 truncate text-xs ${falta.length ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400'}`}>
                          {falta.length ? `Falta: ${falta.join(', ')}` : <><Check className="h-3 w-3" /> Pronto</>}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">
            {atual && (
              <EditorAlojamento key={atual.id} prop={atual} casa={casaDe(atual)} slug={settings?.slug ?? null} aoGuardar={aoGuardar} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

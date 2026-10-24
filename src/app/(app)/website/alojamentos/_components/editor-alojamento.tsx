'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Star, Trash2, X } from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import type { Property } from '@/lib/types'
import { COMODIDADES, nomeComodidade } from '@/lib/comodidades'
import { LIMITES_ALOJAMENTO } from '@/lib/fotos-alojamento'
import { fotosDe } from '@/lib/site-alojamentos'
import { reduzirImagem } from '@/lib/reduzir-imagem'

type Estado = 'guardado' | 'a-guardar' | 'erro'
type Campos = Partial<Pick<Property, 'descricao' | 'regras_casa' | 'comodidades'>> & { fotos?: string[] }

interface Foto {
  chave: string
  url?: string
  preview?: string
  estado: 'pronta' | 'a-carregar' | 'erro'
  erro?: string
}

/**
 * Gravações em fila: cada alteração junta-se à que está por enviar e só há um
 * pedido de cada vez. Sem isto, duas fotografias a acabar de carregar ao
 * mesmo tempo mandavam duas listas, e ganhava a que chegasse por último.
 */
function useGravacao(id: string, aoGuardar: (linha: Partial<Property> & { id: string }) => void) {
  const [estado, setEstado] = useState<Estado>('guardado')
  const pendente = useRef<Campos | null>(null)
  const ocupado = useRef(false)

  const correr = useCallback(async () => {
    if (ocupado.current) return
    ocupado.current = true
    while (pendente.current) {
      const corpo = pendente.current
      pendente.current = null
      setEstado('a-guardar')
      try {
        const res = await fetch(`/api/site/alojamentos/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
        })
        const linha = await res.json().catch(() => null)
        if (!res.ok) throw new Error(linha?.error || 'Não foi possível guardar.')
        aoGuardar(linha)
        if (!pendente.current) setEstado('guardado')
      } catch (e) {
        pendente.current = { ...corpo, ...(pendente.current ?? {}) }
        setEstado('erro')
        toast.error(e instanceof Error ? e.message : 'Não foi possível guardar.')
        break
      }
    }
    ocupado.current = false
  }, [id, aoGuardar])

  const gravar = useCallback((campos: Campos) => {
    pendente.current = { ...(pendente.current ?? {}), ...campos }
    void correr()
  }, [correr])

  return { estado, gravar, tentarOutraVez: () => void correr() }
}

function novaChave() {
  return Math.random().toString(36).slice(2)
}

export function EstadoGravacao({ estado, onTentar }: { estado: Estado; onTentar: () => void }) {
  if (estado === 'a-guardar') {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> A guardar…</span>
  }
  if (estado === 'erro') {
    return <button type="button" onClick={onTentar} className="text-xs font-medium text-destructive underline underline-offset-4">Não guardado — tentar outra vez</button>
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" /> Guardado</span>
}

export function EditorAlojamento({ prop, casa, slug, aoGuardar }: {
  prop: Property
  casa: Property | null
  slug: string | null
  aoGuardar: (linha: Partial<Property> & { id: string }) => void
}) {
  const { estado, gravar, tentarOutraVez } = useGravacao(prop.id, aoGuardar)
  const [fotos, setFotos] = useState<Foto[]>(() => fotosDe(prop).map(url => ({ chave: url, url, estado: 'pronta' })))
  /* Uploads acabam fora de ordem: todas as mudanças partem da lista mais
   * recente (a do ref), e só as que mexem nas fotografias prontas gravam. */
  const fotosRef = useRef(fotos)
  const [descricao, setDescricao] = useState(prop.descricao ?? '')
  const [regras, setRegras] = useState(prop.regras_casa ?? '')
  const [comodidades, setComodidades] = useState<string[]>(prop.comodidades ?? [])
  const [arrastar, setArrastar] = useState<number | null>(null)
  const [zonaAtiva, setZonaAtiva] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  /* Textos: gravam 900 ms depois de parar de escrever, e ao sair do alojamento. */
  const textos = useRef({ descricao, regras_casa: regras })
  const sujo = useRef(false)
  useEffect(() => {
    if (textos.current.descricao === descricao && textos.current.regras_casa === regras) return
    textos.current = { descricao, regras_casa: regras }
    sujo.current = true
    const t = setTimeout(() => { sujo.current = false; gravar({ descricao, regras_casa: regras }) }, 900)
    return () => clearTimeout(t)
  }, [descricao, regras, gravar])
  useEffect(() => () => { if (sujo.current) gravar(textos.current) }, [gravar])

  function aplicar(fn: (l: Foto[]) => Foto[], guardar: boolean) {
    const nova = fn(fotosRef.current)
    fotosRef.current = nova
    setFotos(nova)
    if (guardar) gravar({ fotos: nova.filter(f => f.estado === 'pronta' && f.url).map(f => f.url!) })
  }

  async function carregar(lista: FileList | File[]) {
    const ficheiros = [...lista].filter(f => f.type.startsWith('image/'))
    const livres = LIMITES_ALOJAMENTO.fotos - fotosRef.current.length
    if (ficheiros.length === 0) return
    if (livres <= 0) { toast.error(`No máximo ${LIMITES_ALOJAMENTO.fotos} fotografias por alojamento.`); return }
    const aceites = ficheiros.slice(0, livres)
    if (aceites.length < ficheiros.length) toast.info(`Só cabem mais ${livres} fotografias neste alojamento.`)

    const novas: Foto[] = aceites.map(f => ({ chave: novaChave(), preview: URL.createObjectURL(f), estado: 'a-carregar' }))
    aplicar(l => [...l, ...novas], false)

    for (let i = 0; i < aceites.length; i++) {
      const chave = novas[i].chave
      try {
        const form = new FormData()
        form.append('file', await reduzirImagem(aceites[i]))
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.url) throw new Error(body?.error || 'Não foi possível carregar.')
        URL.revokeObjectURL(novas[i].preview!)
        aplicar(l => l.map(f => f.chave === chave ? { chave, url: body.url, estado: 'pronta' } : f), true)
      } catch (e) {
        aplicar(l => l.map(f => f.chave === chave ? { ...f, estado: 'erro', erro: e instanceof Error ? e.message : 'Falhou' } : f), false)
      }
    }
  }

  function mover(de: number, para: number) {
    if (para < 0 || para >= fotosRef.current.length || de === para) return
    aplicar(l => {
      const c = [...l]
      const [x] = c.splice(de, 1)
      c.splice(para, 0, x)
      return c
    }, true)
  }

  function remover(chave: string) {
    aplicar(l => l.filter(f => f.chave !== chave), true)
  }

  function alternarComodidade(id: string) {
    const nova = comodidades.includes(id) ? comodidades.filter(c => c !== id) : [...comodidades, id]
    setComodidades(nova)
    gravar({ comodidades: nova })
  }

  const prontas = fotos.filter(f => f.estado === 'pronta').length
  const extras = comodidades.filter(c => !COMODIDADES.some(x => x.id === c))
  const linkSite = slug ? `/r/${slug}/alojamento/${prop.id}` : null

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {casa && <p className="text-xs text-muted-foreground">Quarto de {casa.nome}</p>}
          <h2 className="text-xl font-semibold tracking-tight">{prop.nome}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fmtMoney(prop.preco_base)} / noite · até {prop.capacidade} {prop.capacidade === 1 ? 'pessoa' : 'pessoas'} ·{' '}
            <Link href="/precos" className="underline underline-offset-4 hover:text-foreground">preços</Link>
            {' · '}
            <Link href={`/propriedades/${prop.id}/editar`} className="underline underline-offset-4 hover:text-foreground">nome, capacidade e morada</Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EstadoGravacao estado={estado} onTentar={tentarOutraVez} />
          {linkSite && (
            <a href={linkSite} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <ExternalLink className="h-3.5 w-3.5" /> Ver no site
            </a>
          )}
        </div>
      </div>

      {/* Fotografias */}
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold">Fotografias <span className="font-normal text-muted-foreground">· {prontas}</span></h3>
          <p className="text-xs text-muted-foreground">A primeira é a capa. Arrasta para mudar a ordem.</p>
        </div>

        <div
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setZonaAtiva(true) } }}
          onDragLeave={() => setZonaAtiva(false)}
          onDrop={e => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault(); setZonaAtiva(false); void carregar(e.dataTransfer.files)
          }}
          className={`grid grid-cols-2 gap-3 rounded-2xl p-1 transition-colors sm:grid-cols-3 xl:grid-cols-4 ${zonaAtiva ? 'bg-primary/5 ring-2 ring-primary/40' : ''}`}>
          {fotos.map((f, i) => (
            <figure key={f.chave}
              draggable={f.estado === 'pronta'}
              onDragStart={e => { setArrastar(i); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { if (arrastar !== null) e.preventDefault() }}
              onDrop={e => { if (arrastar !== null) { e.preventDefault(); e.stopPropagation(); mover(arrastar, i); setArrastar(null) } }}
              onDragEnd={() => setArrastar(null)}
              className={`group relative aspect-[4/3] overflow-hidden rounded-xl bg-muted ${arrastar === i ? 'opacity-40' : ''} ${f.estado === 'pronta' ? 'cursor-grab active:cursor-grabbing' : ''}`}>
              {(f.url || f.preview) && (
                f.url
                  ? <Image src={f.url} alt="" fill sizes="(max-width: 640px) 50vw, 240px" className="object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local (blob:) antes do upload
                  : <img src={f.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              {f.estado === 'a-carregar' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white"><Loader2 className="h-5 w-5 animate-spin" /></div>
              )}
              {f.estado === 'erro' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-3 text-center text-xs text-white">
                  <span>{f.erro}</span>
                  <button type="button" onClick={() => aplicar(l => l.filter(x => x.chave !== f.chave), false)} className="rounded-md bg-white/15 px-2 py-1 hover:bg-white/25">Retirar</button>
                </div>
              )}
              {i === 0 && f.estado === 'pronta' && (
                <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Capa</span>
              )}
              {f.estado === 'pronta' && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label="Mover para trás"
                      className="rounded-md bg-white/15 p-1.5 text-white hover:bg-white/30 disabled:opacity-30"><ArrowLeft className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => mover(i, i + 1)} disabled={i === fotos.length - 1} aria-label="Mover para a frente"
                      className="rounded-md bg-white/15 p-1.5 text-white hover:bg-white/30 disabled:opacity-30"><ArrowRight className="h-3.5 w-3.5" /></button>
                    {i !== 0 && (
                      <button type="button" onClick={() => mover(i, 0)} aria-label="Usar como capa"
                        className="rounded-md bg-white/15 p-1.5 text-white hover:bg-white/30"><Star className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  <button type="button" onClick={() => remover(f.chave)} aria-label="Remover fotografia"
                    className="rounded-md bg-white/15 p-1.5 text-white hover:bg-red-500/80"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </figure>
          ))}

          <button type="button" onClick={() => input.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground">
            <ImagePlus className="h-6 w-6" />
            <span className="font-medium">Adicionar fotografias</span>
            <span className="hidden text-xs sm:block">ou arrasta-as para aqui</span>
          </button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
          onChange={e => { if (e.target.files) void carregar(e.target.files); e.target.value = '' }} />
        {prontas === 0 && (
          <p className="text-xs text-muted-foreground">Sem fotografias, o site mostra um bloco com o nome na cor do alojamento. Com 5 ou mais, a página fica completa.</p>
        )}
      </section>

      {/* Descrição */}
      <section className="flex flex-col gap-2">
        <label htmlFor={`desc-${prop.id}`} className="text-sm font-semibold">Descrição</label>
        <textarea id={`desc-${prop.id}`} rows={6} value={descricao} maxLength={LIMITES_ALOJAMENTO.descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="O que se vê da janela, como é a cama, o que fica a cinco minutos a pé. Uma linha em branco começa um parágrafo novo."
          className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
        <p className="text-right text-[11px] text-muted-foreground">{descricao.length} / {LIMITES_ALOJAMENTO.descricao}</p>
      </section>

      {/* Comodidades */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Comodidades</h3>
        <div className="flex flex-wrap gap-2">
          {COMODIDADES.map(c => {
            const ativa = comodidades.includes(c.id)
            return (
              <button key={c.id} type="button" onClick={() => alternarComodidade(c.id)} aria-pressed={ativa}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  ativa ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                {ativa && <Check className="h-3.5 w-3.5" />}{c.pt}
              </button>
            )
          })}
          {extras.map(c => (
            <button key={c} type="button" onClick={() => alternarComodidade(c)} aria-label={`Retirar ${nomeComodidade(c, 'pt')}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              {nomeComodidade(c, 'pt')}<X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </section>

      {/* Regras */}
      <section className="flex flex-col gap-2">
        <label htmlFor={`regras-${prop.id}`} className="text-sm font-semibold">Regras da casa <span className="font-normal text-muted-foreground">(opcional)</span></label>
        <textarea id={`regras-${prop.id}`} rows={3} value={regras} maxLength={LIMITES_ALOJAMENTO.regras}
          onChange={e => setRegras(e.target.value)}
          placeholder="Ex.: Check-in a partir das 15h. Não são permitidas festas."
          className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
      </section>
    </div>
  )
}

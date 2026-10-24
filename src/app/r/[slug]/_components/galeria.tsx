'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import type { SiteLang } from '@/lib/i18n'
import { tr } from '@/lib/i18n-reserva'

/**
 * Fotografias de um alojamento: mosaico no computador, deslizar no telemóvel,
 * e o visualizador de ecrã inteiro para as ver todas. Sem fotografias, um
 * bloco com o nome na cor do alojamento — a página continua a ter rosto.
 */
export function Galeria({ fotos, nome, cor, lang }: { fotos: string[]; nome: string; cor: string; lang: SiteLang }) {
  const [aberta, setAberta] = useState<number | null>(null)
  const [atual, setAtual] = useState(0)

  if (fotos.length === 0) {
    return (
      <div className="relative flex aspect-[16/7] min-h-56 w-full items-end overflow-hidden rounded-2xl p-6 sm:p-10"
        style={{ backgroundColor: `${cor}1f` }}>
        <div aria-hidden className="absolute -right-10 -top-16 h-72 w-72 rounded-full opacity-40" style={{ backgroundColor: `${cor}33` }} />
        <div className="relative">
          <p className="site-titulo text-4xl font-semibold sm:text-6xl" style={{ color: cor }}>{nome}</p>
          <p className="mt-2 text-sm text-muted-foreground">{tr(lang, 'sem_fotos')}</p>
        </div>
      </div>
    )
  }

  const mosaico = fotos.slice(0, 5)
  const grelha = mosaico.length === 1 ? 'grid-cols-1'
    : mosaico.length === 2 ? 'grid-cols-2'
    : 'grid-cols-4 grid-rows-2'

  return (
    <>
      {/* Telemóvel: deslizar */}
      <div className="relative -mx-4 sm:hidden">
        <div className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          onScroll={e => setAtual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
          {fotos.map((url, i) => (
            <button key={`${url}-${i}`} type="button" onClick={() => setAberta(i)}
              className="relative aspect-[4/3] w-full shrink-0 snap-center bg-muted">
              <Image src={url} alt={`${nome} — ${i + 1}`} fill sizes="100vw" priority={i === 0} className="object-cover" />
            </button>
          ))}
        </div>
        {fotos.length > 1 && (
          <span className="site-num pointer-events-none absolute bottom-3 right-4 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            {atual + 1} / {fotos.length}
          </span>
        )}
      </div>

      {/* Computador: mosaico */}
      <div className={`relative hidden h-[28rem] gap-2 overflow-hidden rounded-2xl sm:grid lg:h-[32rem] ${grelha}`}>
        {mosaico.map((url, i) => {
          const grande = mosaico.length > 2 && i === 0
          // 3 fotos: duas empilhadas à direita; 4: a última ocupa a largura das duas de cima.
          const larga = (mosaico.length === 3 && i > 0) || (mosaico.length === 4 && i === 3)
          return (
            <button key={`${url}-${i}`} type="button" onClick={() => setAberta(i)}
              aria-label={`${nome} — ${i + 1}`}
              className={`group relative overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                grande ? 'col-span-2 row-span-2' : larga ? 'col-span-2' : ''}`}>
              <Image src={url} alt="" fill priority={i === 0}
                sizes={grande ? '(max-width: 1024px) 50vw, 640px' : '(max-width: 1024px) 25vw, 320px'}
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
            </button>
          )
        })}
        {fotos.length > 1 && (
          <button type="button" onClick={() => setAberta(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur hover:bg-card">
            <Images className="h-4 w-4" aria-hidden />
            {tr(lang, 'fotos_todas', { n: fotos.length })}
          </button>
        )}
      </div>

      {aberta !== null && (
        <Visualizador fotos={fotos} nome={nome} inicio={aberta} lang={lang} onFechar={() => setAberta(null)} />
      )}
    </>
  )
}

function Visualizador({ fotos, nome, inicio, lang, onFechar }: {
  fotos: string[]; nome: string; inicio: number; lang: SiteLang; onFechar: () => void
}) {
  const [i, setI] = useState(inicio)
  const fechar = useRef<HTMLButtonElement>(null)
  const anterior = useCallback(() => setI(n => (n - 1 + fotos.length) % fotos.length), [fotos.length])
  const seguinte = useCallback(() => setI(n => (n + 1) % fotos.length), [fotos.length])

  useEffect(() => {
    const focoAntes = document.activeElement as HTMLElement | null
    fechar.current?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar()
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'ArrowRight') seguinte()
    }
    window.addEventListener('keydown', tecla)
    return () => {
      window.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      focoAntes?.focus()
    }
  }, [onFechar, anterior, seguinte])

  return (
    <div role="dialog" aria-modal="true" aria-label={nome}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="site-num text-sm text-white/70">{i + 1} / {fotos.length}</span>
        <button ref={fechar} type="button" onClick={onFechar} aria-label={tr(lang, 'fotos_fechar')}
          className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="relative flex-1">
        <Image key={fotos[i]} src={fotos[i]} alt={`${nome} — ${i + 1}`} fill sizes="100vw" className="object-contain" />
        {fotos.length > 1 && (
          <>
            <button type="button" onClick={anterior} aria-label={tr(lang, 'fotos_anterior')}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={seguinte} aria-label={tr(lang, 'fotos_seguinte')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {fotos.map((url, n) => (
          <button key={`${url}-${n}`} type="button" onClick={() => setI(n)} aria-label={`${n + 1}`}
            aria-current={n === i || undefined}
            className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-md transition-opacity ${n === i ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-80'}`}>
            <Image src={url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

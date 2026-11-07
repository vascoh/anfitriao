'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { vibrar } from '@/lib/vibrar'

/** Distância (px, já amortecida) a partir da qual largar atualiza. */
const LIMIAR = 64
/** Máximo que o indicador desce, para o gesto não parecer elástico demais. */
const MAXIMO = 96

/**
 * «Puxar para atualizar» no telemóvel, sem biblioteca.
 *
 * A app rola dentro de `<main>` e não no documento, por isso o gesto nativo do
 * browser não existe aqui: sem isto, a única forma de ver uma reserva nova era
 * mudar de ecrã e voltar. Escuta o contentor que rola mais próximo, só começa
 * quando ele está no topo, e amortece o arrasto para metade. Ao passar o
 * limiar dá um toque de vibração, como as apps nativas.
 *
 * Em ecrãs com rato não faz nada (não há toque), e o conteúdo não se mexe:
 * só o indicador desce, para não mexer com o layout nem com o foco.
 */
export function PuxarParaAtualizar({
  onAtualizar,
  children,
}: {
  onAtualizar: () => Promise<unknown>
  children: ReactNode
}) {
  const raiz = useRef<HTMLDivElement>(null)
  const [puxado, setPuxado] = useState(0)
  const [aAtualizar, setAAtualizar] = useState(false)
  const callback = useRef(onAtualizar)
  useEffect(() => { callback.current = onAtualizar }, [onAtualizar])

  useEffect(() => {
    const el = raiz.current
    const contentor = el?.closest('main') ?? null
    if (!el || !contentor) return

    let inicio: number | null = null
    let distancia = 0
    let passouLimiar = false
    let ocupado = false

    function aoTocar(e: TouchEvent) {
      if (ocupado || contentor!.scrollTop > 0 || e.touches.length !== 1) return
      inicio = e.touches[0].clientY
      distancia = 0
      passouLimiar = false
    }

    function aoMover(e: TouchEvent) {
      if (inicio === null) return
      const dy = e.touches[0].clientY - inicio
      if (dy <= 0 || contentor!.scrollTop > 0) {
        inicio = null
        setPuxado(0)
        return
      }
      distancia = Math.min(MAXIMO, dy / 2)
      if (!passouLimiar && distancia >= LIMIAR) {
        passouLimiar = true
        vibrar('toque')
      } else if (passouLimiar && distancia < LIMIAR) {
        passouLimiar = false
      }
      setPuxado(distancia)
    }

    async function aoLargar() {
      if (inicio === null) return
      inicio = null
      if (distancia < LIMIAR) {
        setPuxado(0)
        return
      }
      ocupado = true
      setAAtualizar(true)
      setPuxado(LIMIAR)
      try {
        await callback.current()
      } finally {
        ocupado = false
        setAAtualizar(false)
        setPuxado(0)
      }
    }

    contentor.addEventListener('touchstart', aoTocar, { passive: true })
    contentor.addEventListener('touchmove', aoMover, { passive: true })
    contentor.addEventListener('touchend', aoLargar)
    contentor.addEventListener('touchcancel', aoLargar)
    return () => {
      contentor.removeEventListener('touchstart', aoTocar)
      contentor.removeEventListener('touchmove', aoMover)
      contentor.removeEventListener('touchend', aoLargar)
      contentor.removeEventListener('touchcancel', aoLargar)
    }
  }, [])

  const progresso = Math.min(1, puxado / LIMIAR)
  const visivel = puxado > 0 || aAtualizar

  return (
    <div ref={raiz} className="relative">
      <div
        aria-hidden={!aAtualizar}
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center lg:hidden"
        style={{
          transform: `translateY(${puxado - 40}px)`,
          opacity: visivel ? 1 : 0,
          transition: puxado === 0 || aAtualizar ? 'transform 200ms ease-out, opacity 200ms' : 'none',
        }}
      >
        <span className="grid size-10 place-items-center rounded-full border border-border bg-card text-primary shadow-md">
          <RefreshCw
            className={`size-4 ${aAtualizar ? 'animate-spin motion-reduce:animate-none' : ''}`}
            style={aAtualizar ? undefined : { transform: `rotate(${progresso * 270}deg)` }}
          />
        </span>
      </div>
      {aAtualizar && <span className="sr-only" role="status">A atualizar</span>}
      {children}
    </div>
  )
}

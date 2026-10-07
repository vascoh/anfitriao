'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, MousePointerClick, Navigation, RotateCw, ExternalLink } from 'lucide-react'

/**
 * A pré-visualização do editor: o site verdadeiro, num iframe da mesma origem.
 *
 * Mantém a regra de `website-preview.tsx` — mostra-se a página real, não uma
 * imitação — e acrescenta-lhe o que o editor precisa:
 *
 * - **Apontar e escolher.** As secções do site trazem `data-secao`; aqui
 *   ganham contorno ao passar o rato e, em modo «Editar», um clique escolhe a
 *   secção no mapa em vez de seguir o link. Os textos trazem `data-campo`, e o
 *   clique leva o cursor ao campo certo.
 * - **Ver antes de guardar.** Os textos, a ordem e a visibilidade das secções
 *   da inicial mudam no próprio DOM da página enquanto se escreve. É o mesmo
 *   HTML, com os valores novos — por isso continua a ser o site, e não um
 *   desenho dele. O que exige o servidor (menu, imagem do topo, FAQ) aparece
 *   ao guardar, e o aviso de «por guardar» di-lo.
 *
 * Só funciona porque o iframe é da mesma origem (`X-Frame-Options:
 * SAMEORIGIN`). Num domínio próprio o editor continua a usar `/r/<slug>`.
 */

export interface AlteracoesAoVivo {
  /** `data-campo` → texto. */
  campos: Record<string, string>
  /** `data-campo-paragrafos` → texto com parágrafos separados por linha em branco. */
  paragrafos: Record<string, string>
  /** Secções da inicial pela ordem nova, com a visibilidade nova. */
  secoesInicio: Array<{ id: string; visivel: boolean }>
}

const ESTILO_EDITOR = `
  [data-secao] { transition: outline-color .12s ease; outline: 2px solid transparent; outline-offset: -2px; }
  [data-secao][data-ed-hover] { outline-color: rgba(194,113,79,.55); cursor: pointer; }
  [data-secao][data-ed-sel] { outline-color: rgb(194,113,79); }
  [data-ed-etiqueta] {
    position: fixed; z-index: 2147483647; pointer-events: none;
    font: 600 11px/1 system-ui, sans-serif; color: #fff; background: rgb(194,113,79);
    padding: 4px 7px; border-radius: 6px; white-space: nowrap;
  }
`

export function PrevisualizacaoEditavel({
  url,
  versao,
  secaoSelecionada,
  nomesDasSecoes,
  alteracoes,
  porGuardar,
  onEscolherSecao,
  onEscolherCampo,
  onNavegar,
}: {
  url: string
  /** Muda depois de guardar, para recarregar o site com o que ficou gravado. */
  versao: number
  secaoSelecionada: string | null
  nomesDasSecoes: Record<string, string>
  alteracoes: AlteracoesAoVivo
  porGuardar: boolean
  onEscolherSecao: (secao: string) => void
  onEscolherCampo: (campo: string) => void
  /** O anfitrião navegou dentro da pré-visualização (link do menu, etc.). */
  onNavegar: (pathname: string) => void
}) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [dispositivo, setDispositivo] = useState<'telemovel' | 'computador'>('computador')
  const [modo, setModo] = useState<'editar' | 'navegar'>('editar')
  const [recarregar, setRecarregar] = useState(0)
  const [aCarregar, setACarregar] = useState(true)

  // As props mudam a cada tecla; os ouvintes do iframe leem sempre o valor atual.
  const estado = useRef({ modo, onEscolherSecao, onEscolherCampo, nomesDasSecoes, secaoSelecionada })
  useEffect(() => {
    estado.current = { modo, onEscolherSecao, onEscolherCampo, nomesDasSecoes, secaoSelecionada }
  }, [modo, onEscolherSecao, onEscolherCampo, nomesDasSecoes, secaoSelecionada])

  const documento = useCallback((): Document | null => {
    try { return iframe.current?.contentDocument ?? null } catch { return null }
  }, [])

  /* Aplica os valores do editor ao DOM da página. Idempotente: pode correr a
   * cada tecla e a cada carregamento. */
  const aplicar = useCallback(() => {
    const doc = documento()
    if (!doc) return

    for (const el of doc.querySelectorAll<HTMLElement>('[data-campo]')) {
      const valor = alteracoes.campos[el.dataset.campo ?? '']
      if (valor !== undefined && el.textContent !== valor) el.textContent = valor
    }

    for (const el of doc.querySelectorAll<HTMLElement>('[data-campo-paragrafos]')) {
      const valor = alteracoes.paragrafos[el.dataset.campoParagrafos ?? '']
      if (valor === undefined) continue
      const partes = valor.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
      const atual = [...el.children].map(c => c.textContent).join('\u0000')
      if (atual === partes.join('\u0000')) continue
      el.replaceChildren(...partes.map(p => {
        const novo = doc.createElement('p')
        novo.className = 'whitespace-pre-line'
        novo.textContent = p
        return novo
      }))
    }

    const contentor = doc.querySelector<HTMLElement>('[data-secoes-inicio]')
    if (contentor) {
      for (const { id, visivel } of alteracoes.secoesInicio) {
        const el = contentor.querySelector<HTMLElement>(`:scope > [data-secao="${CSS.escape(id)}"]`)
        if (!el) continue
        contentor.appendChild(el) // reordena: cada uma vai para o fim pela ordem nova
        el.hidden = !visivel
      }
    }
  }, [alteracoes, documento])

  useEffect(() => { aplicar() }, [aplicar])

  /* Marca no site a secção escolhida no mapa, e leva-a à vista. Rola só a
   * janela do iframe: `scrollIntoView` rolaria também o editor à volta. */
  const marcarSelecao = useCallback((secao: string | null, rolar: boolean) => {
    const doc = documento()
    const janela = doc?.defaultView
    if (!doc || !janela) return
    doc.querySelectorAll('[data-ed-sel]').forEach(el => el.removeAttribute('data-ed-sel'))
    if (!secao) return
    const el = doc.querySelector<HTMLElement>(`[data-secao="${CSS.escape(secao)}"]`)
    if (!el) return
    el.setAttribute('data-ed-sel', '')
    if (!rolar) return
    const r = el.getBoundingClientRect()
    if (r.top >= 0 && r.bottom <= janela.innerHeight) return
    const menu = doc.querySelector<HTMLElement>('nav[data-secao="menu"]')?.offsetHeight ?? 0
    janela.scrollTo({ top: Math.max(0, r.top + janela.scrollY - menu - 12), behavior: 'smooth' })
  }, [documento])

  useEffect(() => { marcarSelecao(secaoSelecionada, true) }, [secaoSelecionada, marcarSelecao])

  const aoCarregar = useCallback(() => {
    setACarregar(false)
    const doc = documento()
    const janela = iframe.current?.contentWindow
    if (!doc || !janela) return

    onNavegar(janela.location.pathname)

    const estilo = doc.createElement('style')
    estilo.textContent = ESTILO_EDITOR
    doc.head.appendChild(estilo)

    const etiqueta = doc.createElement('div')
    etiqueta.setAttribute('data-ed-etiqueta', '')
    etiqueta.style.display = 'none'
    doc.body.appendChild(etiqueta)

    let atual: HTMLElement | null = null
    doc.addEventListener('mouseover', e => {
      const alvo = (e.target as HTMLElement).closest<HTMLElement>('[data-secao]')
      if (alvo === atual) return
      atual?.removeAttribute('data-ed-hover')
      atual = alvo
      if (!alvo) { etiqueta.style.display = 'none'; return }
      alvo.setAttribute('data-ed-hover', '')
      const r = alvo.getBoundingClientRect()
      etiqueta.textContent = estado.current.nomesDasSecoes[alvo.dataset.secao ?? ''] ?? alvo.dataset.secao ?? ''
      etiqueta.style.display = 'block'
      etiqueta.style.left = `${Math.max(6, r.left + 6)}px`
      etiqueta.style.top = `${Math.max(6, r.top + 6)}px`
    })
    doc.addEventListener('mouseleave', () => {
      atual?.removeAttribute('data-ed-hover')
      atual = null
      etiqueta.style.display = 'none'
    })
    doc.addEventListener('scroll', () => { etiqueta.style.display = 'none' }, { passive: true })

    doc.addEventListener('click', e => {
      const alvo = e.target as HTMLElement
      if (estado.current.modo !== 'editar') {
        /* Navegar: os links do site mudam de página sem recarregar (Next), e
         * isso não dispara o `load` — o mapa não saberia onde o hóspede está.
         * Forçar a navegação completa nos links internos resolve as duas coisas. */
        const link = alvo.closest<HTMLAnchorElement>('a[href]')
        if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey) return
        const destino = new URL(link.href, janela.location.href)
        if (destino.origin !== janela.location.origin) return
        e.preventDefault()
        e.stopPropagation()
        janela.location.assign(destino.href)
        return
      }
      const secao = alvo.closest<HTMLElement>('[data-secao]')
      if (!secao) return
      // Em modo Editar, um clique numa secção escolhe-a; não segue o link.
      e.preventDefault()
      e.stopPropagation()
      estado.current.onEscolherSecao(secao.dataset.secao ?? '')
      const campo = alvo.closest<HTMLElement>('[data-campo],[data-campo-paragrafos]')
      const nome = campo?.dataset.campo ?? campo?.dataset.campoParagrafos
      if (nome) estado.current.onEscolherCampo(nome)
    }, true)

    aplicar()
    marcarSelecao(estado.current.secaoSelecionada, false)
    /* Se a página ainda estiver a hidratar, o React pode repor o HTML do
     * servidor por cima do que se aplicou. Voltar a aplicar pouco depois. */
    janela.setTimeout(aplicar, 600)
  }, [aplicar, documento, onNavegar, marcarSelecao])

  const telemovel = dispositivo === 'telemovel'

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-border p-0.5" role="group" aria-label="Modo da pré-visualização">
          {([
            ['editar', MousePointerClick, 'Editar', 'Clicar no site escolhe a secção'],
            ['navegar', Navigation, 'Navegar', 'Clicar no site segue os links, como um hóspede'],
          ] as const).map(([valor, Icone, rotulo, ajuda]) => (
            <button key={valor} type="button" onClick={() => setModo(valor)} aria-pressed={modo === valor} title={ajuda}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                modo === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icone className="h-3.5 w-3.5" /> {rotulo}
            </button>
          ))}
        </div>

        <div className="flex items-center rounded-lg border border-border p-0.5" role="group" aria-label="Tamanho do ecrã">
          {([
            ['computador', Monitor, 'Computador'],
            ['telemovel', Smartphone, 'Telemóvel'],
          ] as const).map(([valor, Icone, rotulo]) => (
            <button key={valor} type="button" onClick={() => setDispositivo(valor)} aria-pressed={dispositivo === valor} title={rotulo}
              className={`rounded-md p-1.5 transition-colors ${
                dispositivo === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icone className="h-3.5 w-3.5" />
              <span className="sr-only">{rotulo}</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={() => { setACarregar(true); setRecarregar(v => v + 1) }}
          className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground" title="Recarregar">
          <RotateCw className="h-3.5 w-3.5" />
          <span className="sr-only">Recarregar</span>
        </button>

        <div className="flex-1" />
        <a href={url.replace(/[?&]editar=1/, '')} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir num separador
        </a>
      </div>

      {porGuardar && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          Textos e ordem já se veem aqui. Menu, fotografias e perguntas aparecem quando guardares.
        </p>
      )}

      <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-border bg-muted/30">
        {aCarregar && (
          <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/10">
            <div className="h-full w-1/3 animate-pulse bg-primary" />
          </div>
        )}
        <iframe
          ref={iframe}
          key={`${url}-${versao}-${recarregar}`}
          src={url}
          onLoad={aoCarregar}
          title="Pré-visualização do teu site"
          className={`h-full border-0 bg-white ${telemovel ? 'mx-auto block w-[390px] max-w-full border-x border-border' : 'w-full'}`}
        />
      </div>
    </div>
  )
}

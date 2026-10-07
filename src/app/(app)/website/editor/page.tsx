'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Check, Loader2, Map as MapIcon, PencilLine, Eye } from 'lucide-react'
import { useUser } from '@clerk/nextjs'
import type { Property, WebsiteSettings } from '@/lib/types'
import { fetchPosts, fetchProperties, fetchSettings } from '@/lib/fetcher'
import { resolveLang } from '@/lib/i18n'
import {
  SECOES_OBRIGATORIAS, LIMITES, entradasDoMenu, itensPorque, nomePaginaFixa, secoesDoInicio,
  PAGINAS_FIXAS, SECOES_INICIO, type SecaoInicio, type SiteSecoes,
} from '@/lib/site-mapa'
import {
  caminhoDoNo, mesmoNo, mover, noDoCaminho, paginaDoNo, slugLivre, urlDaPrevisualizacao, NOME_SECAO,
  type NoDoMapa,
} from '@/lib/site-editor'
import { ArvoreDoSite, type EstadoSecao } from '@/components/site-editor/arvore'
import { Inspector } from '@/components/site-editor/inspector'
import { PrevisualizacaoEditavel, type AlteracoesAoVivo } from '@/components/site-editor/previsualizacao-editavel'

/**
 * Editor do site — o mapa do site do anfitrião, à esquerda; o site verdadeiro,
 * ao centro; o que se pode mudar no sítio escolhido, à direita.
 *
 * Os três estão ligados nos dois sentidos: escolher no mapa leva o site lá,
 * clicar no site escolhe no mapa, escrever à direita muda o site enquanto se
 * escreve. No telemóvel são três separadores com o mesmo estado.
 *
 * Grava só o que é dele — o mapa (`secoes`) e os textos que aparecem no site
 * (título, descrição, anfitrião, nome no cabeçalho). Endereço, publicação,
 * contactos e regras de reserva ficam em /website.
 */

type CampoTexto = 'nome' | 'descricao' | 'logo_texto' | 'host_nome' | 'host_bio'
const CAMPOS_GRAVADOS: CampoTexto[] = ['nome', 'descricao', 'logo_texto', 'host_nome', 'host_bio']

function useOrigem() {
  const [origem] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''))
  return origem
}

export default function EditorDoSitePage() {
  const { user } = useUser()
  const origem = useOrigem()
  const [settings, setSettings] = useState<WebsiteSettings | null>(null)
  const [propriedades, setPropriedades] = useState<Property[]>([])
  const [numeroDePosts, setNumeroDePosts] = useState<number | null>(null)
  const [erro, setErro] = useState(false)
  const [semSite, setSemSite] = useState(false)

  const [selecao, setSelecao] = useState<NoDoMapa>({ tipo: 'secao', id: 'hero' })
  /** Página que a pré-visualização mostra — muda com a seleção, não com cada tecla. */
  const [caminho, setCaminho] = useState('')
  /** Campo a focar no painel; leva um carimbo para o mesmo campo poder ser pedido duas vezes. */
  const [campoEmFoco, setCampoEmFocoBruto] = useState<string | null>(null)
  const setCampoEmFoco = useCallback((campo: string | null) => {
    setCampoEmFocoBruto(campo ? `${campo}#${Date.now()}` : null)
  }, [])
  const [porGuardar, setPorGuardar] = useState(false)
  const [aGuardar, setAGuardar] = useState(false)
  const [versao, setVersao] = useState(0)
  const [separador, setSeparador] = useState<'mapa' | 'editar' | 'ver'>('mapa')

  useEffect(() => {
    if (!user?.id) return
    Promise.all([fetchSettings(), fetchProperties()])
      .then(([s, p]) => {
        // Sem definições não há site a editar — nem endereço; mostra-se o caminho para /website.
        if (!s) { setSemSite(true); return }
        setSettings(s)
        setPropriedades(p)
      })
      .catch(() => setErro(true))
    fetchPosts().then(posts => setNumeroDePosts(posts.filter(p => p.publicado).length)).catch(() => {})
  }, [user?.id])

  // Não perder trabalho ao fechar o separador.
  useEffect(() => {
    if (!porGuardar) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [porGuardar])

  const secoes: SiteSecoes = useMemo(() => settings?.secoes ?? {}, [settings?.secoes])
  const lang = resolveLang(settings?.idioma)

  const mudarSettings = useCallback((mudar: (s: WebsiteSettings) => WebsiteSettings) => {
    setSettings(s => (s ? mudar(s) : s))
    setPorGuardar(true)
  }, [])
  const onCampo = useCallback((campo: CampoTexto, valor: string) => {
    mudarSettings(s => ({ ...s, [campo]: valor }))
  }, [mudarSettings])
  const onSecoes = useCallback((mudar: (atual: SiteSecoes) => SiteSecoes) => {
    mudarSettings(s => ({ ...s, secoes: mudar(s.secoes ?? {}) }))
  }, [mudarSettings])

  // ── Secções da inicial ──
  const listaSecoes = secoesDoInicio(secoes)
  const fotosDisponiveis = propriedades.some(p => p.ativo && (p.imagem_url || (p.fotos?.length ?? 0) > 0))
  const estadoSecoes: EstadoSecao[] = listaSecoes.map(s => ({
    ...s,
    vazia:
      (s.id === 'faq' && !(secoes.faq ?? []).some(f => f.pergunta.trim())) ||
      (s.id === 'anfitriao' && !(settings?.host_nome || settings?.host_bio)) ||
      (s.id === 'fotos' && !fotosDisponiveis),
  }))
  const moverSecao = (de: number, para: number) => onSecoes(s => ({ ...s, inicio: mover(secoesDoInicio(s), de, para) }))
  const alternarSecao = (id: SecaoInicio) => {
    if (SECOES_OBRIGATORIAS.includes(id)) return
    onSecoes(s => ({ ...s, inicio: secoesDoInicio(s).map(x => x.id === id ? { ...x, visivel: !x.visivel } : x) }))
  }

  // ── Menu e páginas ──
  const menu = entradasDoMenu(secoes, lang)
  const moverMenu = (de: number, para: number) =>
    onSecoes(s => ({ ...s, menu: mover(entradasDoMenu(s, lang), de, para).map(e => e.id) }))
  const alternarPagina = (id: string) => onSecoes(s => {
    if (id.startsWith('p:')) {
      const slug = id.slice(2)
      return { ...s, paginas_proprias: (s.paginas_proprias ?? []).map(p => p.slug === slug ? { ...p, visivel: !p.visivel } : p) }
    }
    if (!(PAGINAS_FIXAS as readonly string[]).includes(id)) return s
    const atual = s.paginas?.[id as keyof NonNullable<SiteSecoes['paginas']>]
    return { ...s, paginas: { ...s.paginas, [id]: { ...atual, visivel: atual?.visivel === false } } }
  })
  const novaPagina = () => {
    if ((secoes.paginas_proprias?.length ?? 0) >= LIMITES.paginasProprias) {
      toast.error(`Podes ter até ${LIMITES.paginasProprias} páginas próprias.`)
      return
    }
    const titulo = 'Página nova'
    const slug = slugLivre(secoes, titulo)
    onSecoes(s => ({
      ...s,
      paginas_proprias: [...(s.paginas_proprias ?? []), { slug, titulo, texto: '', visivel: false }],
      menu: [...entradasDoMenu(s, lang).map(e => e.id), `p:${slug}`],
    }))
    escolher({ tipo: 'pagina', id: `p:${slug}` })
    setCampoEmFoco(`pagina.${slug}.titulo`)
    toast('Página criada escondida — mostra-a quando tiver texto.')
  }
  const apagarPagina = (slug: string) => {
    const pagina = secoes.paginas_proprias?.find(p => p.slug === slug)
    if (!pagina) return
    if (pagina.texto.trim() && !window.confirm(`Apagar a página «${pagina.titulo}»? O texto perde-se quando guardares.`)) return
    onSecoes(s => ({
      ...s,
      paginas_proprias: (s.paginas_proprias ?? []).filter(p => p.slug !== slug),
      menu: (s.menu ?? []).filter(m => m !== `p:${slug}`),
    }))
    escolher({ tipo: 'pagina', id: 'inicio' })
  }

  // ── Seleção ↔ pré-visualização ──
  function escolher(no: NoDoMapa) {
    setSelecao(no)
    setCampoEmFoco(null)
    const destino = caminhoDoNo(no)
    if (destino !== null) setCaminho(destino)
    setSeparador(atual => (atual === 'mapa' ? 'editar' : atual))
  }

  const onEscolherSecao = useCallback((secao: string) => {
    setCampoEmFoco(null)
    if (secao === 'menu' || secao === 'rodape') setSelecao({ tipo: 'global', id: secao })
    else if (secao === 'hero' || (SECOES_INICIO as readonly string[]).includes(secao)) setSelecao({ tipo: 'secao', id: secao as 'hero' | SecaoInicio })
    // No telemóvel, escolher no site abre o painel de edição.
    setSeparador(atual => (atual === 'ver' ? 'editar' : atual))
  }, [setCampoEmFoco])

  const onNavegar = useCallback((pathname: string) => {
    if (!settings?.slug) return
    const no = noDoCaminho(pathname, settings.slug)
    if (!no) return
    setSelecao(atual => (mesmoNo(paginaDoNo(atual), paginaDoNo(no)) || (atual.tipo === 'global') ? atual : no))
    /* O caminho onde o hóspede está de facto — não o do nó: «Cookies» e um
     * artigo do blog pertencem a nós cujo caminho é outro, e voltar a ele
     * desfazia o clique. */
    const prefixo = `/r/${settings.slug}`
    setCaminho(pathname.startsWith('/book/') ? pathname : pathname.slice(prefixo.length).replace(/\/+$/, ''))
  }, [settings?.slug])

  async function guardar() {
    if (!settings || aGuardar) return
    if (!settings.nome.trim()) {
      toast.error('O site precisa de um título.')
      escolher({ tipo: 'secao', id: 'hero' })
      setCampoEmFoco('nome')
      return
    }
    setAGuardar(true)
    const corpo: Record<string, unknown> = { secoes: settings.secoes ?? {} }
    for (const campo of CAMPOS_GRAVADOS) corpo[campo] = settings[campo] ?? ''
    try {
      const res = await fetch('/api/website-settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Não foi possível guardar.')
        return
      }
      // O servidor limpa o mapa (endereços das páginas, limites): ler o que ficou.
      const gravado = await fetchSettings()
      if (gravado) setSettings(gravado)
      setPorGuardar(false)
      setVersao(v => v + 1)
      toast.success(settings.enabled ? 'Guardado — já está no site.' : 'Guardado. O site continua desligado.')
    } finally {
      setAGuardar(false)
    }
  }

  // Ctrl/⌘+S guarda.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void guardar() }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  // ── O que a pré-visualização aplica ao vivo ──
  const alteracoes: AlteracoesAoVivo = useMemo(() => {
    const campos: Record<string, string> = {}
    const paragrafos: Record<string, string> = {}
    if (settings) {
      campos.nome = settings.nome
      campos.descricao = settings.descricao
      campos.logo_texto = settings.logo_texto || settings.nome
      campos.host_nome = settings.host_nome || settings.nome
      if (settings.host_bio) campos.host_bio = settings.host_bio
      itensPorque(secoes, lang).forEach((item, i) => {
        campos[`porque.${i}.titulo`] = item.titulo
        campos[`porque.${i}.texto`] = item.texto
      })
      paragrafos.sobre_texto = secoes.sobre_texto ?? ''
      for (const p of secoes.paginas_proprias ?? []) {
        campos[`pagina.${p.slug}.titulo`] = p.titulo
        paragrafos[`pagina.${p.slug}.texto`] = p.texto
      }
    }
    return { campos, paragrafos, secoesInicio: secoesDoInicio(secoes) }
  }, [settings, secoes, lang])

  const nomesDasSecoes = useMemo(() => ({
    ...NOME_SECAO, menu: 'Cabeçalho e menu', rodape: 'Rodapé',
  }), [])

  // ── Estados de carregamento ──
  if (erro) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Não foi possível carregar o site. <button className="font-semibold text-primary" onClick={() => location.reload()}>Tentar outra vez</button>
      </div>
    )
  }
  if (!settings && !semSite) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> A abrir o editor…
      </div>
    )
  }
  if (!settings?.slug) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <MapIcon className="h-8 w-8 text-primary" />
        <h1 className="text-lg font-semibold">Primeiro, o endereço do site</h1>
        <p className="text-sm text-muted-foreground">O editor mostra o teu site verdadeiro, e para isso ele precisa de um endereço.</p>
        <Link href="/website" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Escolher endereço</Link>
      </div>
    )
  }

  const url = urlDaPrevisualizacao(origem, settings.slug, caminho)
  const secaoNoSite =
    selecao.tipo === 'secao' ? selecao.id : selecao.tipo === 'global' ? selecao.id : null

  const tituloSelecao =
    selecao.tipo === 'secao' ? NOME_SECAO[selecao.id]
      : selecao.tipo === 'global' ? (selecao.id === 'menu' ? 'Cabeçalho e menu' : 'Rodapé')
        : selecao.tipo === 'alojamento' ? (propriedades.find(p => p.id === selecao.id)?.nome ?? 'Alojamento')
          : selecao.id === 'inicio' ? 'Início'
            : selecao.id === 'legais' ? 'Páginas legais'
              : selecao.id.startsWith('p:') ? (secoes.paginas_proprias?.find(p => `p:${p.slug}` === selecao.id)?.titulo ?? 'Página')
                : nomePaginaFixa(secoes, selecao.id as (typeof PAGINAS_FIXAS)[number], lang)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barra de topo */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:px-6">
        <Link href="/website" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Definições do site">
          <ArrowLeft className="h-4 w-4" /><span className="sr-only">Voltar às definições do site</span>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight lg:text-lg">Editor do site</h1>
          <p className="truncate text-[11px] text-muted-foreground">
            {settings.enabled ? 'Publicado' : 'Desligado — só tu o vês'} · <span className="lg:hidden">{tituloSelecao}</span>
            <span className="hidden lg:inline">escolhe no mapa ou clica no site</span>
          </p>
        </div>
        <span className={`hidden text-xs sm:inline ${porGuardar ? 'text-amber-600' : 'text-muted-foreground'}`} aria-live="polite">
          {porGuardar ? 'Alterações por guardar' : 'Tudo guardado'}
        </span>
        <button type="button" onClick={guardar} disabled={!porGuardar || aGuardar}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-40">
          {aGuardar ? <Loader2 className="h-4 w-4 animate-spin" /> : !porGuardar ? <Check className="h-4 w-4" /> : null}
          Guardar
        </button>
      </header>

      {/* Separadores — só no telemóvel e tablet */}
      <div className="grid grid-cols-3 border-b border-border lg:hidden" role="tablist" aria-label="Partes do editor">
        {([
          ['mapa', MapIcon, 'Mapa'],
          ['editar', PencilLine, 'Editar'],
          ['ver', Eye, 'Ver site'],
        ] as const).map(([valor, Icone, rotulo]) => (
          <button key={valor} type="button" role="tab" aria-selected={separador === valor} onClick={() => setSeparador(valor)}
            className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              separador === valor ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'
            }`}>
            <Icone className="h-3.5 w-3.5" /> {rotulo}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)_340px] xl:grid-cols-[280px_minmax(0,1fr)_380px]">
        <aside className={`min-h-0 overflow-y-auto border-border p-3 lg:block lg:border-r ${separador === 'mapa' ? 'block' : 'hidden'}`}>
          <ArvoreDoSite
            selecao={selecao}
            onSelecionar={escolher}
            secoes={estadoSecoes}
            onMoverSecao={moverSecao}
            onAlternarSecao={alternarSecao}
            menu={menu}
            onMoverMenu={moverMenu}
            onAlternarPagina={alternarPagina}
            onNovaPagina={novaPagina}
            alojamentos={propriedades.filter(p => !p.parent_id)}
          />
        </aside>

        <section className={`min-h-0 flex-col p-3 lg:flex lg:p-4 ${separador === 'ver' ? 'flex h-full' : 'hidden'}`} aria-label="Pré-visualização">
          <PrevisualizacaoEditavel
            url={url}
            versao={versao}
            secaoSelecionada={secaoNoSite}
            nomesDasSecoes={nomesDasSecoes}
            alteracoes={alteracoes}
            porGuardar={porGuardar}
            onEscolherSecao={onEscolherSecao}
            onEscolherCampo={setCampoEmFoco}
            onNavegar={onNavegar}
          />
        </section>

        <aside className={`min-h-0 overflow-y-auto border-border p-4 lg:block lg:border-l ${separador === 'editar' ? 'block' : 'hidden'}`} aria-label="Editar">
          <Inspector
            no={selecao}
            settings={settings}
            secoes={secoes}
            propriedades={propriedades}
            numeroDePosts={numeroDePosts}
            campoEmFoco={campoEmFoco}
            onCampo={onCampo}
            onSecoes={onSecoes}
            onAlternarSecao={alternarSecao}
            onAlternarPagina={alternarPagina}
            onApagarPagina={apagarPagina}
          />
        </aside>
      </div>
    </div>
  )
}

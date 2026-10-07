'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Check, Loader2, Map as MapIcon, PencilLine, Eye, Undo2 } from 'lucide-react'
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
  /** Páginas próprias criadas e ainda não guardadas: o endereço segue o título até à primeira gravação. */
  const [paginasNovas, setPaginasNovas] = useState<string[]>([])

  useEffect(() => {
    if (!user?.id) return
    Promise.all([fetchSettings(), fetchProperties()])
      .then(([s, p]) => {
        // Sem definições não há site a editar — nem endereço; mostra-se o caminho para /website.
        if (!s) { setSemSite(true); return }
        setSettings(s)
        setGravado(s)
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

  /* Desfazer: uma pilha de estados anteriores. Teclas seguidas no mesmo campo
   * contam como um passo — desfazer letra a letra não serve a ninguém. */
  const [gravado, setGravado] = useState<WebsiteSettings | null>(null)
  const [historico, setHistorico] = useState<WebsiteSettings[]>([])
  const ultimoPasso = useRef(0)
  /* O estado atual, lido e escrito em sincronia: duas mudanças no mesmo
   * instante (ex.: criar uma página mexe nas páginas e no menu) não se
   * pisam, e o histórico não depende de efeitos dentro de atualizadores. */
  const atual = useRef<WebsiteSettings | null>(null)
  useEffect(() => { atual.current = settings }, [settings])
  const mudarSettings = useCallback((mudar: (s: WebsiteSettings) => WebsiteSettings) => {
    const antes = atual.current
    if (!antes) return
    const agora = Date.now()
    if (agora - ultimoPasso.current > 800) setHistorico(h => [...h.slice(-49), antes])
    ultimoPasso.current = agora
    const depois = mudar(antes)
    atual.current = depois
    setSettings(depois)
    setPorGuardar(true)
  }, [])
  const desfazer = useCallback(() => {
    const anterior = historico.at(-1)
    if (!anterior) return
    atual.current = anterior
    setSettings(anterior)
    setHistorico(historico.slice(0, -1))
    setPorGuardar(JSON.stringify(anterior) !== JSON.stringify(gravado))
    ultimoPasso.current = 0
  }, [historico, gravado])
  const descartar = () => {
    if (!gravado) return
    if (!window.confirm('Descartar todas as alterações que ainda não guardaste?')) return
    atual.current = gravado
    setSettings(gravado)
    setHistorico([])
    setPaginasNovas([])
    setPorGuardar(false)
    setVersao(v => v + 1)
  }
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
      (s.id === 'fotos' && !fotosDisponiveis) ||
      (s.id === 'opinioes' && !(secoes.opinioes ?? []).some(o => o.texto.trim())),
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
    setPaginasNovas(n => [...n, slug])
    escolher({ tipo: 'pagina', id: `p:${slug}` }, [slug])
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
    setPaginasNovas(n => n.filter(x => x !== slug))
    escolher({ tipo: 'pagina', id: 'inicio' })
  }
  /* O título de uma página nova dá-lhe o endereço — «Regras da casa» fica em
   * /p/regras-da-casa e não em /p/pagina-nova. Depois de guardada, o endereço
   * fica fixo, para os links já partilhados não partirem. */
  const tituloDaPagina = (slug: string, titulo: string) => {
    if (!paginasNovas.includes(slug)) {
      onSecoes(s => ({ ...s, paginas_proprias: (s.paginas_proprias ?? []).map(p => p.slug === slug ? { ...p, titulo } : p) }))
      return
    }
    const outras = (secoes.paginas_proprias ?? []).filter(p => p.slug !== slug)
    const novo = slugLivre({ ...secoes, paginas_proprias: outras }, titulo || 'pagina')
    onSecoes(s => ({
      ...s,
      paginas_proprias: (s.paginas_proprias ?? []).map(p => p.slug === slug ? { ...p, titulo, slug: novo } : p),
      menu: (s.menu ?? []).map(m => m === `p:${slug}` ? `p:${novo}` : m),
    }))
    if (novo !== slug) {
      setPaginasNovas(n => n.map(x => x === slug ? novo : x))
      setSelecao(atual => (atual.tipo === 'pagina' && atual.id === `p:${slug}` ? { tipo: 'pagina', id: `p:${novo}` } : atual))
    }
  }

  // ── Seleção ↔ pré-visualização ──
  function escolher(no: NoDoMapa, novas: string[] = paginasNovas) {
    setSelecao(no)
    setCampoEmFoco(null)
    // Uma página ainda não guardada não existe no servidor: o site fica onde está.
    const porGravar = no.tipo === 'pagina' && no.id.startsWith('p:') && novas.includes(no.id.slice(2))
    const destino = caminhoDoNo(no)
    if (destino !== null && !porGravar) setCaminho(destino)
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
      const novo = await fetchSettings()
      if (novo) { atual.current = novo; setSettings(novo); setGravado(novo) }
      setHistorico([])
      setPorGuardar(false)
      setPaginasNovas([])
      setVersao(v => v + 1)
      toast.success(settings.enabled ? 'Guardado — já está no site.' : 'Guardado. O site continua desligado.')
    } finally {
      setAGuardar(false)
    }
  }

  // Ctrl/⌘+S guarda; Ctrl/⌘+Z desfaz (fora de um campo de texto, onde vale o do browser).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 's') { e.preventDefault(); void guardar() }
      if (k === 'z' && !e.shiftKey) {
        const alvo = e.target as HTMLElement | null
        const aEscrever = alvo?.closest('input, textarea, select, [contenteditable="true"]')
        if (!aEscrever) { e.preventDefault(); desfazer() }
      }
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
      // O título das páginas Galeria, Localização e Blog é o nome no menu.
      for (const e of entradasDoMenu(secoes, lang)) if (!e.propria) campos[`menu.${e.id}`] = e.label
      paragrafos.sobre_texto = secoes.sobre_texto ?? ''
      paragrafos.zona_texto = secoes.zona_texto ?? ''
      for (const p of secoes.paginas_proprias ?? []) {
        campos[`pagina.${p.slug}.titulo`] = p.titulo
        paragrafos[`pagina.${p.slug}.texto`] = p.texto
      }
    }
    return {
      campos, paragrafos,
      secoesInicio: secoesDoInicio(secoes),
      menu: entradasDoMenu(secoes, lang).map(({ id, label, visivel }) => ({ id, label, visivel })),
    }
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
        <span className={`hidden text-xs xl:inline ${porGuardar ? 'text-amber-600' : 'text-muted-foreground'}`} aria-live="polite">
          {porGuardar ? 'Alterações por guardar' : 'Tudo guardado'}
        </span>
        <button type="button" onClick={desfazer} disabled={historico.length === 0} title="Desfazer (Ctrl+Z)"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30">
          <Undo2 className="h-4 w-4" /><span className="sr-only">Desfazer</span>
        </button>
        {porGuardar && (
          <button type="button" onClick={descartar}
            className="hidden rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:block">
            Descartar
          </button>
        )}
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
            onTituloPagina={tituloDaPagina}
            paginasNovas={paginasNovas}
          />
        </aside>
      </div>
    </div>
  )
}

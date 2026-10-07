'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, Eye, EyeOff, Plus, RotateCcw, Trash2, Lock, Upload, Loader2 } from 'lucide-react'
import type { Property, WebsiteSettings } from '@/lib/types'
import {
  LIMITES, SECOES_OBRIGATORIAS, entradasDoMenu, itensPorque, nomePaginaFixa,
  type Opiniao, type PaginaFixa, type PaginaPropria, type SecaoInicio, type SiteSecoes,
} from '@/lib/site-mapa'
import { NOME_SECAO, type NoDoMapa } from '@/lib/site-editor'
import { resolveLang } from '@/lib/i18n'

/**
 * O painel do que está selecionado no mapa: o que o hóspede vê ali, de onde
 * vem e como se muda.
 *
 * Regra que segue em todos os nós: **o que já existe noutro sítio da app não
 * se edita aqui outra vez**. As fotografias e os preços são do alojamento, os
 * artigos são do blog, os contactos são das definições do site — aqui diz-se
 * isso e leva-se lá. Duas formas de editar a mesma coisa acabam por divergir.
 */

type CampoTexto = 'nome' | 'descricao' | 'logo_texto' | 'host_nome' | 'host_bio'

export interface InspectorProps {
  no: NoDoMapa
  settings: WebsiteSettings
  secoes: SiteSecoes
  propriedades: Property[]
  numeroDePosts: number | null
  campoEmFoco: string | null
  onCampo: (campo: CampoTexto, valor: string) => void
  onSecoes: (mudar: (atual: SiteSecoes) => SiteSecoes) => void
  onAlternarSecao: (id: SecaoInicio) => void
  onAlternarPagina: (id: string) => void
  onApagarPagina: (slug: string) => void
  onTituloPagina: (slug: string, titulo: string) => void
  /** Páginas próprias ainda não guardadas — o endereço ainda segue o título. */
  paginasNovas: string[]
}

export function Inspector(props: InspectorProps) {
  const { no, campoEmFoco } = props

  // Clicar num texto no site leva o cursor ao campo correspondente.
  useEffect(() => {
    if (!campoEmFoco) return
    const el = document.getElementById(`campo-${campoEmFoco.split('#')[0]}`)
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus()
      el.select()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [campoEmFoco, no])

  switch (no.tipo) {
    case 'global': return no.id === 'menu' ? <PainelMenu {...props} /> : <PainelRodape {...props} />
    case 'secao': return <PainelSecao {...props} id={no.id} />
    case 'alojamento': return <PainelAlojamento {...props} id={no.id} />
    case 'pagina':
      if (no.id === 'inicio') return <PainelInicio {...props} />
      if (no.id === 'legais') return <PainelLegais />
      if (no.id.startsWith('p:')) return <PainelPaginaPropria {...props} slug={no.id.slice(2)} />
      return <PainelPaginaFixa {...props} id={no.id as PaginaFixa} />
  }
}

// ─── Peças ────────────────────────────────────────────────────────────────────

function Cabecalho({ titulo, descricao, acao }: { titulo: string; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-tight">{titulo}</h2>
        {acao}
      </div>
      {descricao && <p className="text-xs leading-relaxed text-muted-foreground">{descricao}</p>}
    </div>
  )
}

function Campo({
  id, rotulo, valor, onChange, placeholder, max, linhas, ajuda,
}: {
  id: string
  rotulo: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  max: number
  linhas?: number
  ajuda?: string
}) {
  const comum = 'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring'
  const perto = valor.length > max * 0.85
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`campo-${id}`} className="text-xs font-medium text-muted-foreground">{rotulo}</label>
        {perto && <span className="text-[10px] tabular-nums text-muted-foreground">{valor.length}/{max}</span>}
      </div>
      {linhas ? (
        <textarea id={`campo-${id}`} value={valor} rows={linhas} maxLength={max} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} className={`${comum} resize-y leading-relaxed`} />
      ) : (
        <input id={`campo-${id}`} type="text" value={valor} maxLength={max} placeholder={placeholder}
          onChange={e => onChange(e.target.value)} className={comum} />
      )}
      {ajuda && <p className="text-[11px] leading-relaxed text-muted-foreground">{ajuda}</p>}
    </div>
  )
}

function Visibilidade({ visivel, onAlternar, bloqueada, oQue }: { visivel: boolean; onAlternar?: () => void; bloqueada?: string; oQue: string }) {
  if (bloqueada) {
    return (
      <p className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" /> {bloqueada}
      </p>
    )
  }
  return (
    <button type="button" onClick={onAlternar} aria-pressed={visivel}
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
        visivel ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-muted/40'
      }`}>
      {visivel ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
      <span className="flex-1">
        <span className="block font-medium">{visivel ? `${oQue} à vista` : `${oQue} escondida`}</span>
        <span className="block text-[11px] text-muted-foreground">
          {visivel ? 'Os hóspedes veem-na. Toca para esconder.' : 'Só tu a vês na pré-visualização. Toca para mostrar.'}
        </span>
      </span>
    </button>
  )
}

function Origem({ children, href, acao }: { children: ReactNode; href: string; acao: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border px-3 py-3">
      <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      <Link href={href} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary">
        {acao} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function fotosDe(propriedades: Property[]): Array<{ url: string; nome: string }> {
  const porUrl = new Map<string, string>()
  for (const p of propriedades) {
    if (!p.ativo) continue
    for (const url of [p.imagem_url, ...(p.fotos ?? [])]) {
      if (url && !porUrl.has(url)) porUrl.set(url, p.nome)
    }
  }
  return [...porUrl].map(([url, nome]) => ({ url, nome }))
}

// ─── Painéis ──────────────────────────────────────────────────────────────────

function PainelMenu({ settings, onCampo, secoes }: InspectorProps) {
  const lang = resolveLang(settings.idioma)
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Cabeçalho e menu" descricao="Aparece no topo de todas as páginas. A ordem do menu é a do mapa — arrasta lá as páginas." />
      <Campo id="logo_texto" rotulo="Nome no cabeçalho" valor={settings.logo_texto ?? ''} max={60}
        placeholder={settings.nome} onChange={v => onCampo('logo_texto', v)}
        ajuda="Se ficar vazio, usa o título do site." />
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">Menu, por esta ordem</p>
        <ol className="flex flex-wrap gap-1.5 text-xs">
          <li className="rounded-full bg-muted px-2.5 py-1">Início</li>
          {entradasDoMenu(secoes, lang).filter(e => e.visivel).map(e => (
            <li key={e.id} className="rounded-full bg-muted px-2.5 py-1">{e.label}</li>
          ))}
        </ol>
      </div>
      <Origem href="/website" acao="Email e WhatsApp">
        O botão de WhatsApp e o email do cabeçalho vêm dos contactos do site.
      </Origem>
    </div>
  )
}

function PainelRodape({ settings }: InspectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Rodapé" descricao="Igual em todas as páginas." />
      <ul className="flex flex-col gap-2 text-sm">
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">Email</span><span className="truncate">{settings.email || '—'}</span></li>
        <li className="flex justify-between gap-3"><span className="text-muted-foreground">Telefone</span><span className="truncate">{settings.telefone || '—'}</span></li>
      </ul>
      <Origem href="/website" acao="Mudar contactos">Os contactos são os das definições do site.</Origem>
      <Origem href="/propriedades" acao="Ver alojamentos">
        O número de registo AL de cada alojamento aparece aqui sozinho — a lei obriga a que conste da publicidade do alojamento, e o site é publicidade.
      </Origem>
    </div>
  )
}

function PainelLegais() {
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Privacidade, cookies e termos"
        descricao="Três páginas ligadas no rodapé. Não se escondem: um site que recolhe dados de reserva tem de as ter." />
      <p className="text-xs leading-relaxed text-muted-foreground">
        O texto é um modelo gerado com o nome e os contactos do teu site, e diz isso no fim de cada página. Revê-o e, se as tuas condições forem outras, adapta-o com quem te aconselha.
      </p>
    </div>
  )
}

function PainelInicio({ secoes, onSecoes, propriedades, settings }: InspectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo="Página inicial"
        descricao="A primeira coisa que o hóspede vê. Ordena e esconde as secções no mapa, ou clica numa delas no site." />
      <SeletorImagemTopo secoes={secoes} onSecoes={onSecoes} propriedades={propriedades} />
      <p className="text-[11px] text-muted-foreground">Título e descrição: escolhe «{NOME_SECAO.hero}» no mapa ou clica no título do site. Agora: «{settings.nome}».</p>
    </div>
  )
}

function SeletorImagemTopo({ secoes, onSecoes, propriedades }: Pick<InspectorProps, 'secoes' | 'onSecoes' | 'propriedades'>) {
  const atual = secoes.hero_imagem ?? null
  const [aCarregar, setACarregar] = useState(false)
  const daCasa = fotosDe(propriedades)
  // Uma fotografia carregada aqui não pertence a nenhum alojamento: mostra-se à cabeça.
  const fotos = atual && !daCasa.some(f => f.url === atual) ? [{ url: atual, nome: 'Carregada por ti' }, ...daCasa] : daCasa

  async function carregar(ficheiro: File) {
    setACarregar(true)
    try {
      const corpo = new FormData()
      corpo.append('file', ficheiro)
      const res = await fetch('/api/upload', { method: 'POST', body: corpo })
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível carregar a fotografia.')
      onSecoes(s => ({ ...s, hero_imagem: data.url }))
      toast.success('Fotografia carregada — guarda para a ver no site.')
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível carregar a fotografia.')
    } finally {
      setACarregar(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Fotografia de fundo do topo</p>
        <label className={`flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary ${aCarregar ? 'pointer-events-none opacity-60' : ''}`}>
          {aCarregar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {aCarregar ? 'A carregar…' : 'Carregar'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void carregar(f) }} />
        </label>
      </div>
      {fotos.length === 0 ? (
        <Origem href="/propriedades" acao="Juntar fotografias">
          Ainda não há fotografias nos teus alojamentos. Carrega uma aqui, ou junta-as aos alojamentos para servirem também na galeria.
        </Origem>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          <button type="button" onClick={() => onSecoes(s => ({ ...s, hero_imagem: null }))} aria-pressed={!atual}
            className={`flex aspect-[4/3] items-center justify-center rounded-md border text-[11px] ${!atual ? 'border-primary ring-2 ring-primary/30' : 'border-border text-muted-foreground'}`}>
            Sem foto
          </button>
          {fotos.slice(0, 17).map(f => (
            <button key={f.url} type="button" onClick={() => onSecoes(s => ({ ...s, hero_imagem: f.url }))} aria-pressed={atual === f.url}
              title={f.nome}
              className={`relative aspect-[4/3] overflow-hidden rounded-md border ${atual === f.url ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
              <Image src={f.url} alt={f.nome} fill sizes="100px" className="object-cover" />
              {atual === f.url && (
                <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground"><Check className="h-3 w-3" /></span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PainelSecao(props: InspectorProps & { id: 'hero' | SecaoInicio }) {
  const { id, settings, secoes, onSecoes, onCampo, onAlternarSecao, propriedades } = props
  const lang = resolveLang(settings.idioma)
  const estado = id === 'hero' ? null : (secoes.inicio?.find(s => s.id === id) ?? null)
  const visivel = id === 'hero' ? true : estado ? estado.visivel : id !== 'fotos'

  const visibilidade = id === 'hero'
    ? <Visibilidade visivel oQue="Secção" bloqueada="O topo está sempre no cimo da página." />
    : SECOES_OBRIGATORIAS.includes(id)
      ? <Visibilidade visivel oQue="Secção" bloqueada="Os alojamentos são o que o site existe para mostrar: podes mudá-los de lugar, não escondê-los." />
      : <Visibilidade visivel={visivel} oQue="Secção" onAlternar={() => onAlternarSecao(id)} />

  if (id === 'hero') {
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.hero} descricao="O título é também o nome do site no Google e no separador do browser." />
        <Campo id="nome" rotulo="Título" valor={settings.nome} max={90} onChange={v => onCampo('nome', v)}
          placeholder="Casa do Mar — Ericeira" />
        <Campo id="descricao" rotulo="Descrição" valor={settings.descricao} max={300} linhas={3}
          onChange={v => onCampo('descricao', v)} placeholder="Duas casas a 200 m da praia, para famílias e surfistas."
          ajuda="Uma ou duas frases. Também é o texto que o Google mostra por baixo do título." />
        <SeletorImagemTopo secoes={secoes} onSecoes={onSecoes} propriedades={propriedades} />
      </div>
    )
  }

  if (id === 'alojamentos') {
    const casas = propriedades.filter(p => !p.parent_id)
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.alojamentos} descricao="Um cartão por alojamento ativo, com foto, preço por noite e botão de reserva. Os quartos reservam-se dentro da casa." />
        {visibilidade}
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {casas.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.cor }} />
              <span className={`flex-1 truncate text-sm ${p.ativo ? '' : 'text-muted-foreground line-through'}`}>{p.nome}</span>
              <Link href={`/propriedades/${p.id}/editar`} className="text-xs font-semibold text-primary">Editar</Link>
            </li>
          ))}
          {casas.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Ainda sem alojamentos.</li>}
        </ul>
        <p className="text-[11px] leading-relaxed text-muted-foreground">Nome, fotos, preço e comodidades vêm de cada alojamento — muda-os lá e o site acompanha.</p>
      </div>
    )
  }

  if (id === 'fotos') {
    const n = fotosDe(propriedades).length
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.fotos} descricao="Uma montra com as seis primeiras fotografias dos teus alojamentos, e ligação para a galeria completa." />
        {visibilidade}
        <Origem href="/propriedades" acao="Gerir fotografias">
          {n === 0 ? 'Ainda não há fotografias — enquanto não houver, a secção não aparece.' : `${n} fotografia${n === 1 ? '' : 's'} disponíve${n === 1 ? 'l' : 'is'}. A ordem é a dos alojamentos.`}
        </Origem>
      </div>
    )
  }

  if (id === 'porque') {
    const itens = itensPorque(secoes, lang)
    const proprios = Boolean(secoes.porque)
    const mudar = (i: number, campo: 'titulo' | 'texto', v: string) =>
      onSecoes(s => {
        // Grava só o que difere do texto de origem: o resto continua a
        // acompanhar o idioma do site se ele mudar.
        const fabrica = itensPorque({}, lang)
        const base = itensPorque(s, lang)
        base[i] = { ...base[i], [campo]: v }
        return {
          ...s,
          porque: base.map((item, j) => ({
            titulo: item.titulo === fabrica[j].titulo ? '' : item.titulo,
            texto: item.texto === fabrica[j].texto ? '' : item.texto,
          })),
        }
      })
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.porque}
          descricao="Três razões para reservar contigo e não na plataforma. Os textos de origem são genéricos — se não fazes cancelamento flexível, por exemplo, muda o terceiro."
          acao={proprios ? (
            <button type="button" onClick={() => onSecoes(s => { const { porque: _, ...resto } = s; return resto })}
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3 w-3" /> Repor
            </button>
          ) : undefined} />
        {visibilidade}
        {itens.map((item, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Campo id={`porque.${i}.titulo`} rotulo={`Razão ${i + 1}`} valor={item.titulo} max={LIMITES.porqueTitulo}
              onChange={v => mudar(i, 'titulo', v)} />
            <Campo id={`porque.${i}.texto`} rotulo="Explicação" valor={item.texto} max={LIMITES.porqueTexto} linhas={2}
              onChange={v => mudar(i, 'texto', v)} />
          </div>
        ))}
      </div>
    )
  }

  if (id === 'faq') {
    const faq = secoes.faq ?? []
    const mudar = (novo: NonNullable<SiteSecoes['faq']>) => onSecoes(s => ({ ...s, faq: novo }))
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.faq} descricao="As dúvidas que te fazem sempre: horas de entrada, estacionamento, animais, berço." />
        {visibilidade}
        {faq.map((item, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <input aria-label={`Pergunta ${i + 1}`} value={item.pergunta} maxLength={LIMITES.pergunta} placeholder="Pergunta"
                onChange={e => mudar(faq.map((f, j) => j === i ? { ...f, pergunta: e.target.value } : f))}
                className="flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="button" onClick={() => mudar(faq.filter((_, j) => j !== i))}
                className="p-1.5 text-muted-foreground hover:text-destructive" title="Apagar pergunta">
                <Trash2 className="h-4 w-4" /><span className="sr-only">Apagar pergunta {i + 1}</span>
              </button>
            </div>
            <textarea aria-label={`Resposta ${i + 1}`} value={item.resposta} maxLength={LIMITES.resposta} placeholder="Resposta" rows={2}
              onChange={e => mudar(faq.map((f, j) => j === i ? { ...f, resposta: e.target.value } : f))}
              className="resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        ))}
        {faq.length < LIMITES.faq && (
          <button type="button" onClick={() => mudar([...faq, { pergunta: '', resposta: '' }])}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-semibold text-primary">
            <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
          </button>
        )}
        {faq.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES_FAQ.map(p => (
              <button key={p} type="button" onClick={() => mudar([...faq, { pergunta: p, resposta: '' }])}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">
                + {p}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (id === 'opinioes') {
    const lista = secoes.opinioes ?? []
    const mudar = (nova: Opiniao[]) => onSecoes(s => ({ ...s, opinioes: nova }))
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.opinioes}
          descricao="Copia as melhores opiniões que já recebeste, e diz de onde vêm — um hóspede desconfiado pode ir confirmá-las. Não inventes nem mudes o sentido: opiniões falsas são uma prática comercial desleal, proibida por lei." />
        {visibilidade}
        {lista.map((o, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <textarea aria-label={`Opinião ${i + 1}`} value={o.texto} maxLength={LIMITES.textoOpiniao} rows={3}
              placeholder="«A casa é ainda melhor do que nas fotos…»"
              onChange={e => mudar(lista.map((x, j) => j === i ? { ...x, texto: e.target.value } : x))}
              className="resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <div className="flex items-center gap-2">
              <input aria-label={`Nome de quem escreveu a opinião ${i + 1}`} value={o.nome} maxLength={LIMITES.nomeOpiniao}
                placeholder="Nome (ex.: Marta, Lisboa)"
                onChange={e => mudar(lista.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <select aria-label={`Origem da opinião ${i + 1}`} value={o.origem ?? ''}
                onChange={e => mudar(lista.map((x, j) => j === i ? { ...x, origem: (e.target.value || undefined) as Opiniao['origem'] } : x))}
                className="rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Origem…</option>
                <option value="airbnb">Airbnb</option>
                <option value="booking">Booking.com</option>
                <option value="google">Google</option>
                <option value="direto">Reserva direta</option>
              </select>
              <button type="button" onClick={() => mudar(lista.filter((_, j) => j !== i))}
                className="p-1.5 text-muted-foreground hover:text-destructive" title="Apagar opinião">
                <Trash2 className="h-4 w-4" /><span className="sr-only">Apagar opinião {i + 1}</span>
              </button>
            </div>
          </div>
        ))}
        {lista.length < LIMITES.opinioes && (
          <button type="button" onClick={() => mudar([...lista, { nome: '', texto: '' }])}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-xs font-semibold text-primary">
            <Plus className="h-3.5 w-3.5" /> Adicionar opinião
          </button>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">Uma opinião sem texto não é guardada. Duas a quatro chegam; seis no máximo é o que se lê.</p>
      </div>
    )
  }

  if (id === 'zona') {
    return (
      <div className="flex flex-col gap-4">
        <Cabecalho titulo={NOME_SECAO.zona} descricao="Mostra as localidades dos teus alojamentos e o texto que escreveres sobre a zona. O mesmo texto aparece na página Localização." />
        {visibilidade}
        <CampoZona secoes={secoes} onSecoes={onSecoes} />
      </div>
    )
  }

  // anfitrião
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo={NOME_SECAO.anfitriao} descricao="Uma cara por trás do alojamento. Aparece aqui e na página Sobre." />
      {visibilidade}
      <CamposAnfitriao settings={settings} onCampo={onCampo} />
    </div>
  )
}

function CampoZona({ secoes, onSecoes }: Pick<InspectorProps, 'secoes' | 'onSecoes'>) {
  return (
    <Campo id="zona_texto" rotulo="Sobre a zona" valor={secoes.zona_texto ?? ''} max={LIMITES.zonaTexto} linhas={8}
      onChange={v => onSecoes(s => ({ ...s, zona_texto: v }))}
      placeholder={'A praia de Ribeira d’Ilhas fica a 5 minutos a pé. Há padaria e farmácia na mesma rua.\n\nDe Lisboa são 40 minutos de carro; o autocarro pára a 200 m.'}
      ajuda="O que um hóspede pergunta antes de reservar: praia, restaurantes, transportes, estacionamento. Também ajuda o Google a perceber onde estás." />
  )
}

const SUGESTOES_FAQ = [
  'A que horas posso fazer o check-in?',
  'Há estacionamento?',
  'Aceitam animais?',
  'Como chego do aeroporto?',
]

function CamposAnfitriao({ settings, onCampo }: Pick<InspectorProps, 'settings' | 'onCampo'>) {
  return (
    <>
      <Campo id="host_nome" rotulo="O teu nome" valor={settings.host_nome ?? ''} max={80}
        placeholder={settings.nome} onChange={v => onCampo('host_nome', v)} />
      <Campo id="host_bio" rotulo="Uma frase sobre ti" valor={settings.host_bio ?? ''} max={300} linhas={3}
        placeholder="Nasci na Ericeira e recebo hóspedes desde 2016. Sei onde se come o melhor peixe."
        onChange={v => onCampo('host_bio', v)}
        ajuda="Sem nome nem frase, a secção do anfitrião não aparece na inicial." />
    </>
  )
}

function PainelPaginaFixa(props: InspectorProps & { id: PaginaFixa }) {
  const { id, settings, secoes, onSecoes, onAlternarPagina, numeroDePosts, propriedades } = props
  const lang = resolveLang(settings.idioma)
  const visivel = secoes.paginas?.[id]?.visivel !== false
  const nomePadrao = nomePaginaFixa({}, id, lang)
  const nome = secoes.paginas?.[id]?.nome ?? ''
  const mudarNome = (v: string) => onSecoes(s => ({
    ...s, paginas: { ...s.paginas, [id]: { ...s.paginas?.[id], nome: v } },
  }))

  const conteudo: Record<PaginaFixa, ReactNode> = {
    sobre: (
      <>
        <CamposAnfitriao settings={settings} onCampo={props.onCampo} />
        <Campo id="sobre_texto" rotulo="A tua história (opcional)" valor={secoes.sobre_texto ?? ''} max={LIMITES.sobreTexto} linhas={8}
          onChange={v => onSecoes(s => ({ ...s, sobre_texto: v }))}
          placeholder={'Como começou, o que gostas na zona, o que fazes para cada estadia correr bem.\n\nDeixa uma linha em branco entre parágrafos.'}
          ajuda="Texto simples. Uma linha em branco começa um parágrafo novo." />
      </>
    ),
    galeria: (
      <Origem href="/propriedades" acao="Gerir fotografias">
        Mostra todas as fotografias dos alojamentos ativos ({fotosDe(propriedades).length}). Para mudar, junta ou tira fotografias em cada alojamento.
      </Origem>
    ),
    localizacao: (
      <>
      <CampoZona secoes={secoes} onSecoes={onSecoes} />
      <Origem href="/propriedades" acao="Ver alojamentos">
        Um ponto por alojamento, com ligação ao mapa. A morada completa só aparece nos alojamentos onde escolheste mostrá-la; nos outros vê-se só a localidade.
      </Origem>
      </>
    ),
    blog: (
      <Origem href="/blog" acao="Escrever no blog">
        {numeroDePosts === null ? 'Os artigos geres no blog.' : numeroDePosts === 0 ? 'Ainda não há artigos publicados — a página mostra uma mensagem a dizer isso. Pode valer a pena escondê-la até haver.' : `${numeroDePosts} artigo${numeroDePosts === 1 ? '' : 's'} publicado${numeroDePosts === 1 ? '' : 's'}.`}
      </Origem>
    ),
  }

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo={nome || nomePadrao} descricao="Uma das páginas que todos os sites trazem. Podes dar-lhe outro nome, mudá-la de lugar no menu ou escondê-la."  />
      <Visibilidade visivel={visivel} oQue="Página" onAlternar={() => onAlternarPagina(id)} />
      <Campo id={`menu.${id}`} rotulo="Nome no menu" valor={nome} max={LIMITES.nomeMenu} placeholder={nomePadrao}
        onChange={mudarNome} />
      {conteudo[id]}
    </div>
  )
}

function PainelPaginaPropria(props: InspectorProps & { slug: string }) {
  const { slug, secoes, onSecoes, onAlternarPagina, onApagarPagina, onTituloPagina, paginasNovas } = props
  const nova = paginasNovas.includes(slug)
  const pagina = secoes.paginas_proprias?.find(p => p.slug === slug)
  if (!pagina) return <p className="text-sm text-muted-foreground">Esta página já não existe.</p>

  const mudar = (campo: keyof PaginaPropria, valor: string) => onSecoes(s => ({
    ...s,
    paginas_proprias: (s.paginas_proprias ?? []).map(p => p.slug === slug ? { ...p, [campo]: valor } : p),
  }))

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo={pagina.titulo || 'Página sem título'} descricao={nova
          ? <>Endereço: <span className="font-mono">/p/{pagina.slug}</span> — acompanha o título até guardares; depois fica fixo. A página aparece na pré-visualização quando guardares.</>
          : <>Endereço: <span className="font-mono">/p/{pagina.slug}</span> — não muda se mudares o título, para os links que já partilhaste continuarem a funcionar.</>}
        acao={
          <button type="button" onClick={() => onApagarPagina(slug)}
            className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Apagar
          </button>
        } />
      <Visibilidade visivel={pagina.visivel} oQue="Página" onAlternar={() => onAlternarPagina(`p:${slug}`)} />
      <Campo id={`pagina.${slug}.titulo`} rotulo="Título (e nome no menu)" valor={pagina.titulo} max={LIMITES.tituloPagina}
        onChange={v => onTituloPagina(slug, v)} />
      <Campo id={`pagina.${slug}.texto`} rotulo="Texto" valor={pagina.texto} max={LIMITES.textoPagina} linhas={14}
        onChange={v => mudar('texto', v)}
        placeholder={'Escreve como numa mensagem.\n\nDeixa uma linha em branco entre parágrafos.'}
        ajuda="Texto simples, como no blog. Uma linha em branco começa um parágrafo novo." />
    </div>
  )
}

function PainelAlojamento({ id, propriedades }: InspectorProps & { id: string }) {
  const p = propriedades.find(x => x.id === id)
  if (!p) return <p className="text-sm text-muted-foreground">Alojamento não encontrado.</p>
  const quartos = propriedades.filter(q => q.parent_id === p.id)
  return (
    <div className="flex flex-col gap-4">
      <Cabecalho titulo={p.nome} descricao="A página onde o hóspede escolhe as datas e reserva. É montada a partir do alojamento: fotografias, descrição, comodidades, preços e disponibilidade." />
      {!p.ativo && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Este alojamento está inativo — não aparece no site nem aceita reservas.
        </p>
      )}
      {quartos.length > 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Reserva-se inteiro ou por quarto — {quartos.map(q => q.nome).join(', ')} — nesta mesma página.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Link href={`/propriedades/${p.id}/editar`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Editar fotografias, descrição e comodidades <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/precos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          Preços e mínimo de noites <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

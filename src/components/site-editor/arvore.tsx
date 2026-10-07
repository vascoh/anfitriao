'use client'

import { useState, type ReactNode } from 'react'
import {
  ChevronUp, ChevronDown, Eye, EyeOff, GripVertical, Home, FileText, Image as ImageIcon, MapPin,
  Newspaper, Scale, Plus, PanelTop, PanelBottom, BedDouble, Lock,
} from 'lucide-react'
import type { Property } from '@/lib/types'
import { SECOES_OBRIGATORIAS, type EntradaMenu, type SecaoInicio } from '@/lib/site-mapa'
import { mesmoNo, NOME_SECAO, type NoDoMapa } from '@/lib/site-editor'

/**
 * O mapa do site, como o hóspede o percorre: o menu em cima, a inicial com as
 * suas secções, as páginas pela ordem do menu, as páginas de reserva de cada
 * alojamento e o rodapé com as páginas legais.
 *
 * Cada linha diz de onde vem o seu conteúdo e se está à vista. Reordenar é
 * arrastar (rato) ou usar as setas (teclado e telemóvel).
 */

const ICONE_PAGINA: Record<string, typeof Home> = {
  sobre: FileText, galeria: ImageIcon, localizacao: MapPin, blog: Newspaper,
}

export interface EstadoSecao {
  id: SecaoInicio
  visivel: boolean
  /** Visível mas sem conteúdo: o site salta-a. */
  vazia: boolean
}

export function ArvoreDoSite({
  selecao,
  onSelecionar,
  secoes,
  onMoverSecao,
  onAlternarSecao,
  menu,
  onMoverMenu,
  onAlternarPagina,
  onNovaPagina,
  alojamentos,
}: {
  selecao: NoDoMapa | null
  onSelecionar: (no: NoDoMapa) => void
  secoes: EstadoSecao[]
  onMoverSecao: (de: number, para: number) => void
  onAlternarSecao: (id: SecaoInicio) => void
  menu: EntradaMenu[]
  onMoverMenu: (de: number, para: number) => void
  onAlternarPagina: (id: string) => void
  onNovaPagina: () => void
  alojamentos: Property[]
}) {
  return (
    <nav aria-label="Mapa do site" className="flex flex-col gap-4 text-sm">
      <Grupo titulo="Em todas as páginas">
        <Linha no={{ tipo: 'global', id: 'menu' }} selecao={selecao} onSelecionar={onSelecionar}
          icone={<PanelTop className="h-4 w-4" />} titulo="Cabeçalho e menu" />
      </Grupo>

      <Grupo titulo="Página inicial">
        <Linha no={{ tipo: 'pagina', id: 'inicio' }} selecao={selecao} onSelecionar={onSelecionar}
          icone={<Home className="h-4 w-4" />} titulo="Início" detalhe="sempre no menu" />
        <ul className="ml-4 border-l border-border pl-2 flex flex-col">
          <li>
            <Linha no={{ tipo: 'secao', id: 'hero' }} selecao={selecao} onSelecionar={onSelecionar}
              titulo={NOME_SECAO.hero} pequeno fixo />
          </li>
          <ListaOrdenavel
            itens={secoes}
            chave={s => s.id}
            onMover={onMoverSecao}
            render={(s, i, alavanca) => (
              <Linha no={{ tipo: 'secao', id: s.id }} selecao={selecao} onSelecionar={onSelecionar}
                titulo={NOME_SECAO[s.id]} pequeno
                oculta={!s.visivel}
                detalhe={s.visivel && s.vazia ? 'vazia' : undefined}
                alavanca={alavanca}
                acoes={
                  <>
                    <Setas i={i} total={secoes.length} onMover={onMoverSecao} nome={NOME_SECAO[s.id]} />
                    {SECOES_OBRIGATORIAS.includes(s.id)
                      ? <span title="Os alojamentos estão sempre à vista" className="p-1 text-muted-foreground/60"><Lock className="h-3.5 w-3.5" /></span>
                      : <Olho visivel={s.visivel} onClick={() => onAlternarSecao(s.id)} nome={NOME_SECAO[s.id]} />}
                  </>
                }
              />
            )}
          />
        </ul>
      </Grupo>

      <Grupo
        titulo="Páginas do menu"
        acao={
          <button type="button" onClick={onNovaPagina}
            className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Plus className="h-3.5 w-3.5" /> Nova página
          </button>
        }
      >
        <ul className="flex flex-col">
          <ListaOrdenavel
            itens={menu}
            chave={e => e.id}
            onMover={onMoverMenu}
            render={(e, i, alavanca) => {
              const Icone = e.propria ? FileText : ICONE_PAGINA[e.id] ?? FileText
              return (
                <Linha no={{ tipo: 'pagina', id: e.id } as NoDoMapa} selecao={selecao} onSelecionar={onSelecionar}
                  icone={<Icone className="h-4 w-4" />} titulo={e.label}
                  detalhe={e.propria ? 'página própria' : undefined}
                  oculta={!e.visivel}
                  alavanca={alavanca}
                  acoes={
                    <>
                      <Setas i={i} total={menu.length} onMover={onMoverMenu} nome={e.label} />
                      <Olho visivel={e.visivel} onClick={() => onAlternarPagina(e.id)} nome={e.label} />
                    </>
                  }
                />
              )
            }}
          />
        </ul>
      </Grupo>

      {alojamentos.length > 0 && (
        <Grupo titulo="Páginas de reserva">
          <ul className="flex flex-col">
            {alojamentos.map(p => (
              <li key={p.id}>
                <Linha no={{ tipo: 'alojamento', id: p.id }} selecao={selecao} onSelecionar={onSelecionar}
                  icone={<BedDouble className="h-4 w-4" />} titulo={p.nome}
                  oculta={!p.ativo} detalhe={p.ativo ? undefined : 'inativo'} />
              </li>
            ))}
          </ul>
        </Grupo>
      )}

      <Grupo titulo="Rodapé">
        <Linha no={{ tipo: 'global', id: 'rodape' }} selecao={selecao} onSelecionar={onSelecionar}
          icone={<PanelBottom className="h-4 w-4" />} titulo="Contactos e registo AL" />
        <Linha no={{ tipo: 'pagina', id: 'legais' }} selecao={selecao} onSelecionar={onSelecionar}
          icone={<Scale className="h-4 w-4" />} titulo="Privacidade, cookies, termos" detalhe="obrigatórias" />
      </Grupo>
    </nav>
  )
}

function Grupo({ titulo, acao, children }: { titulo: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  )
}

function Linha({
  no, selecao, onSelecionar, icone, titulo, detalhe, oculta, pequeno, fixo, acoes, alavanca,
}: {
  no: NoDoMapa
  selecao: NoDoMapa | null
  onSelecionar: (no: NoDoMapa) => void
  icone?: ReactNode
  titulo: string
  detalhe?: string
  oculta?: boolean
  pequeno?: boolean
  fixo?: boolean
  acoes?: ReactNode
  alavanca?: ReactNode
}) {
  const ativo = mesmoNo(selecao, no)
  return (
    <div className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${
      ativo ? 'bg-primary/10 text-foreground' : 'hover:bg-muted'
    }`}>
      {alavanca ?? (fixo ? <span className="w-4" /> : null)}
      <button type="button" onClick={() => onSelecionar(no)} aria-current={ativo ? 'true' : undefined}
        className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left ${alavanca || fixo ? '' : 'pl-2'} ${pequeno ? 'text-[13px]' : ''}`}>
        {icone && <span className={ativo ? 'text-primary' : 'text-muted-foreground'}>{icone}</span>}
        <span className={`truncate ${oculta ? 'text-muted-foreground line-through decoration-muted-foreground/40' : ativo ? 'font-medium' : ''}`}>
          {titulo}
        </span>
        {detalhe && (
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
            detalhe === 'vazia' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
          }`}>{detalhe}</span>
        )}
      </button>
      {acoes && <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 focus-within:opacity-100">{acoes}</div>}
    </div>
  )
}

function Olho({ visivel, onClick, nome }: { visivel: boolean; onClick: () => void; nome: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={visivel}
      title={visivel ? `Esconder «${nome}»` : `Mostrar «${nome}»`}
      className="rounded p-1 text-muted-foreground hover:text-foreground">
      {visivel ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      <span className="sr-only">{visivel ? `Esconder ${nome}` : `Mostrar ${nome}`}</span>
    </button>
  )
}

function Setas({ i, total, onMover, nome }: { i: number; total: number; onMover: (de: number, para: number) => void; nome: string }) {
  return (
    <span className="flex items-center">
      <button type="button" disabled={i === 0} onClick={() => onMover(i, i - 1)}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25" title="Subir">
        <ChevronUp className="h-3.5 w-3.5" /><span className="sr-only">Subir {nome}</span>
      </button>
      <button type="button" disabled={i === total - 1} onClick={() => onMover(i, i + 1)}
        className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25" title="Descer">
        <ChevronDown className="h-3.5 w-3.5" /><span className="sr-only">Descer {nome}</span>
      </button>
    </span>
  )
}

/** Arrastar e largar nativo do HTML — sem biblioteca, e as setas cobrem o resto. */
function ListaOrdenavel<T>({
  itens, chave, onMover, render,
}: {
  itens: T[]
  chave: (item: T) => string
  onMover: (de: number, para: number) => void
  render: (item: T, i: number, alavanca: ReactNode) => ReactNode
}) {
  const [arrastado, setArrastado] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<number | null>(null)

  return (
    <>
      {itens.map((item, i) => (
        <li
          key={chave(item)}
          draggable
          onDragStart={e => { setArrastado(i); e.dataTransfer.effectAllowed = 'move' }}
          onDragOver={e => { if (arrastado === null) return; e.preventDefault(); setAlvo(i) }}
          onDragLeave={() => setAlvo(a => (a === i ? null : a))}
          onDrop={e => {
            e.preventDefault()
            if (arrastado !== null) onMover(arrastado, i)
            setArrastado(null); setAlvo(null)
          }}
          onDragEnd={() => { setArrastado(null); setAlvo(null) }}
          className={`rounded-lg ${arrastado === i ? 'opacity-40' : ''} ${
            alvo === i && arrastado !== null && arrastado !== i ? 'ring-2 ring-primary/40' : ''
          }`}
        >
          {render(item, i, (
            <span aria-hidden className="flex w-4 shrink-0 cursor-grab justify-center text-muted-foreground/50 active:cursor-grabbing">
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          ))}
        </li>
      ))}
    </>
  )
}

import Link from 'next/link'
import { verificarConfiguracao, verificarOperacao, piorNivel, type Nivel, type Verificacao } from '@/lib/saude'

export const dynamic = 'force-dynamic'

const CORES: Record<Nivel, string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/5',
  aviso: 'border-amber-500/30 bg-amber-500/5',
  erro: 'border-red-500/30 bg-red-500/5',
}

const PONTOS: Record<Nivel, string> = {
  ok: 'bg-emerald-500',
  aviso: 'bg-amber-500',
  erro: 'bg-red-500',
}

const RESUMO: Record<Nivel, string> = {
  ok: 'Está tudo a funcionar.',
  aviso: 'Há coisas a precisar de atenção.',
  erro: 'Há coisas partidas.',
}

function Linha({ v }: { v: Verificacao }) {
  return (
    <li className={`flex items-start gap-3 rounded-xl border p-4 ${CORES[v.nivel]}`}>
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PONTOS[v.nivel]}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{v.titulo}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v.detalhe}</p>
        {v.accao && (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{v.accao}</p>
        )}
      </div>
    </li>
  )
}

/**
 * Saúde do sistema.
 *
 * Pergunta pelo que **devia ter acontecido e não aconteceu** — é assim que as
 * falhas deste produto se manifestam. Ver a nota em `lib/saude.ts`.
 */
export default async function SaudePage() {
  const configuracao = verificarConfiguracao()
  const operacao = await verificarOperacao()
  const nivel = piorNivel([...configuracao, ...operacao])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saúde do sistema</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {RESUMO[nivel]} Esta página pergunta pelo que devia ter acontecido e não aconteceu —
          é assim que as falhas aqui se manifestam: por ausência, não por erro.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Configuração
        </h2>
        <ul className="flex flex-col gap-2">
          {configuracao.map(v => <Linha key={v.chave + v.titulo} v={v} />)}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Operação (últimos dias)
        </h2>
        <ul className="flex flex-col gap-2">
          {operacao.map(v => <Linha key={v.chave} v={v} />)}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">
        Isto não substitui monitorização a sério (Sentry, PostHog) — substitui o nada.
        Enquanto não houver, é aqui que se vê.{' '}
        <Link href="/admin/contas" className="text-primary hover:underline">Ver contas →</Link>
      </p>
    </div>
  )
}

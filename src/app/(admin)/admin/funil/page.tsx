import { createAdminClient } from '@/lib/supabase'
import { carregarTudo } from '@/lib/supabase-tudo'
import {
  PASSOS, calcularFunil,
  type ContaFunil, type PropriedadeFunil, type ReservaFunil, type SiteFunil,
} from '@/lib/funil-ativacao'

export const dynamic = 'force-dynamic'

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short' }).format(new Date(iso))

/**
 * Funil de ativação: onde cada anfitrião fica parado. Ver `lib/funil-ativacao.ts`.
 * Protegido pelo layout do grupo `(admin)`, no servidor.
 */
export default async function FunilPage() {
  const supabase = createAdminClient()
  const [contas, propriedades, reservas, sites] = await Promise.all([
    carregarTudo<ContaFunil>(() =>
      supabase.from('accounts').select('clerk_user_id, email, nome, criado_em, estado').order('criado_em').order('id')),
    carregarTudo<PropriedadeFunil>(() =>
      supabase.from('properties').select('owner_id, criado_em, ical_feeds').order('criado_em').order('id')),
    carregarTudo<ReservaFunil>(() =>
      supabase.from('bookings')
        .select('owner_id, criado_em, hospede_id, uid_externo, notas, origem, estado, historico')
        .order('criado_em').order('id')),
    carregarTudo<SiteFunil>(() =>
      supabase.from('website_settings').select('owner_id, enabled, slug').order('id')),
  ])
  const erro = contas.erro ?? propriedades.erro ?? reservas.erro ?? sites.erro

  const funil = calcularFunil({
    contas: contas.linhas,
    propriedades: propriedades.linhas,
    reservas: reservas.linhas,
    sites: sites.linhas,
    adminUserId: process.env.ADMIN_USER_ID,
  })

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Funil de ativação</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Onde cada anfitrião fica parado, a partir do que está na base — sem tracking no browser.
          A tua conta aparece na lista mas não entra nos totais.
        </p>
        {erro && <p className="mt-2 text-sm text-red-600">Leitura incompleta: {erro}</p>}
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PASSOS.map((p, i) => {
          const n = funil.totais[p.chave]
          const anterior = i === 0 ? funil.externas : funil.totais[PASSOS[i - 1].chave]
          return (
            <div key={p.chave} className="rounded-xl border border-border bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{p.titulo}</p>
              <p className="mt-1 text-2xl font-bold">{n}</p>
              <p className="text-[11px] text-muted-foreground">
                {i === 0 ? 'contas externas' : anterior > 0 ? `${Math.round((n / anterior) * 100)}% do passo anterior` : '—'}
              </p>
            </div>
          )
        })}
      </section>

      <section className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Conta</th>
              <th className="px-3 py-2">Dias</th>
              <th className="px-3 py-2">Parado em</th>
              {PASSOS.slice(1).map(p => <th key={p.chave} className="px-3 py-2">{p.titulo}</th>)}
            </tr>
          </thead>
          <tbody>
            {funil.linhas.length === 0 && (
              <tr><td colSpan={PASSOS.length + 2} className="px-3 py-6 text-center text-muted-foreground">Sem contas.</td></tr>
            )}
            {funil.linhas.map(l => (
              <tr key={l.clerkUserId} className="border-t border-border">
                <td className="px-3 py-2">
                  <p className="font-medium">{l.nome || l.email}</p>
                  <p className="text-[11px] text-muted-foreground">{l.email}{l.interna ? ' · interna' : ''} · {l.estado}</p>
                </td>
                <td className="px-3 py-2 tabular-nums">{l.diasDesdeRegisto}</td>
                <td className="px-3 py-2">
                  {l.paradoEm
                    ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                        {PASSOS.find(p => p.chave === l.paradoEm)?.titulo}
                      </span>
                    : <span className="text-xs text-emerald-600">completo</span>}
                </td>
                {PASSOS.slice(1).map(p => {
                  const v = l.passos[p.chave]
                  return (
                    <td key={p.chave} className="px-3 py-2 text-xs text-muted-foreground">
                      {v === undefined ? '—' : v === true ? '✓' : fmt(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

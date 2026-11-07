import { listAllAccounts } from '@/lib/accounts'
import type { AccountEstado, AccountPlano } from '@/lib/accounts'
import { PLAN_PRICE_EUR } from '@/lib/stripe'
import Link from 'next/link'
import { diasDeTrial } from '@/lib/planos'

// ─── Helpers de UI ────────────────────────────────────────────────────────────

const estadoLabel: Record<AccountEstado, string> = {
  trial: 'Trial',
  activo: 'Activo',
  suspenso: 'Suspenso',
  cancelado: 'Cancelado',
}

const estadoClasses: Record<AccountEstado, string> = {
  trial:     'bg-info/10 text-info',
  activo:    'bg-sucesso/10 text-sucesso',
  suspenso:  'bg-erro/10 text-erro',
  cancelado: 'bg-muted text-muted-foreground',
}

const planoLabel: Record<AccountPlano, string> = {
  trial:   '—',
  starter: 'Starter',
  pro:     'Pro',
  empresa: 'Empresa',
}

const planoClasses: Record<AccountPlano, string> = {
  trial:   'text-muted-foreground',
  starter: 'text-info font-medium',
  pro:     'text-primary font-semibold',
  empresa: 'text-sucesso font-semibold',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso))
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContasPage() {
  const contas = await listAllAccounts()

  // Estatísticas
  const total     = contas.length
  const emTrial   = contas.filter(c => c.estado === 'trial').length
  const activos   = contas.filter(c => c.estado === 'activo').length
  const suspensos = contas.filter(c => c.estado === 'suspenso').length
  const mrr = contas
    .filter(c => c.estado === 'activo')
    .reduce((sum, c) => sum + PLAN_PRICE_EUR[c.plano], 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Contas</h1>
        <p className="text-sm text-muted-foreground mt-1">Todos os anfitriões registados na plataforma.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Total', value: total,     color: 'text-foreground' },
          { label: 'Trial',    value: emTrial,  color: 'text-info' },
          { label: 'Activos',  value: activos,  color: 'text-sucesso' },
          { label: 'Suspensos',value: suspensos,color: 'text-erro' },
          { label: 'MRR',      value: `€${mrr}`,color: 'text-primary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      {contas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhum anfitrião registado ainda.</p>
          <p className="text-muted-foreground text-xs mt-1">As contas são criadas automaticamente no primeiro login.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Anfitrião</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Plano</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Props.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Trial</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Registado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contas.map(conta => {
                const daysLeft = diasDeTrial(conta.trial_ends_at)
                const trialExpired = daysLeft !== null && daysLeft < 0

                return (
                  <tr key={conta.id} className="hover:bg-muted/40 transition-colors">
                    {/* Nome + email */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground leading-tight">
                        {conta.nome ?? <span className="text-muted-foreground italic">Sem nome</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{conta.email || '—'}</p>
                    </td>

                    {/* Estado badge */}
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoClasses[conta.estado]}`}>
                        {estadoLabel[conta.estado]}
                      </span>
                    </td>

                    {/* Plano */}
                    <td className={`px-5 py-3.5 hidden sm:table-cell text-sm ${planoClasses[conta.plano]}`}>
                      {planoLabel[conta.plano]}
                    </td>

                    {/* Propriedades */}
                    <td className="px-5 py-3.5 hidden md:table-cell text-muted-foreground">
                      {conta.propriedades_count} / {conta.propriedades_max}
                    </td>

                    {/* Trial restante */}
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      {conta.estado === 'trial' && daysLeft !== null ? (
                        <span className={`text-xs ${trialExpired ? 'text-erro font-medium' : 'text-muted-foreground'}`}>
                          {trialExpired ? 'Expirado' : `${daysLeft}d`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Data de registo */}
                    <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-muted-foreground">
                      {fmtDate(conta.criado_em)}
                    </td>

                    {/* Acção */}
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/contas/${conta.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

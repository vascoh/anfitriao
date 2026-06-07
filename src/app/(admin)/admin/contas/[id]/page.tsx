import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAccountById } from '@/lib/accounts'
import { createAdminClient } from '@/lib/supabase'
import { EditAccountForm } from './EditAccountForm'
import type { AccountEstado, AccountPlano } from '@/lib/accounts'

const supabase = createAdminClient()

// ─── Helpers ──────────────────────────────────────────────────────────────────

const estadoLabel: Record<AccountEstado, string> = {
  trial: 'Trial', activo: 'Activo', suspenso: 'Suspenso', cancelado: 'Cancelado',
}
const estadoClasses: Record<AccountEstado, string> = {
  trial:     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  activo:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  suspenso:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  cancelado: 'bg-muted text-muted-foreground',
}
const planoLabel: Record<AccountPlano, string> = {
  trial: '— Sem plano pago', starter: 'Starter · €19/mês', pro: 'Pro · €39/mês',
}

function fmtDatetime(iso: string) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function trialInfo(trialEndsAt: string | null) {
  if (!trialEndsAt) return null
  const d = new Date(trialEndsAt)
  const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000)
  return { date: d.toLocaleDateString('pt-PT'), daysLeft }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ContaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const conta = await getAccountById(id)
  if (!conta) notFound()

  // Propriedades desta conta
  const { data: propriedades } = await supabase
    .from('properties')
    .select('id, nome, tipo, cidade, ativo, criado_em')
    .eq('owner_id', conta.clerk_user_id)
    .order('criado_em', { ascending: false })

  // Reservas recentes
  const { data: reservas } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, estado, preco_total, criado_em')
    .eq('owner_id', conta.clerk_user_id)
    .order('criado_em', { ascending: false })
    .limit(5)

  const trial = trialInfo(conta.trial_ends_at)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/admin/contas" className="hover:text-foreground transition-colors">Contas</Link>
        <span>›</span>
        <span className="text-foreground font-medium">{conta.nome ?? (conta.email || 'Sem nome')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Coluna principal ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Info card */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg font-bold text-foreground">
                  {conta.nome ?? <span className="text-muted-foreground italic font-normal">Sem nome</span>}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">{conta.email || '—'}</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${estadoClasses[conta.estado]}`}>
                {estadoLabel[conta.estado]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Plano</p>
                <p className="font-medium">{planoLabel[conta.plano]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Propriedades</p>
                <p className="font-medium">{propriedades?.length ?? 0} / {conta.propriedades_max}</p>
              </div>
              {trial && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Trial termina</p>
                  <p className={`font-medium ${trial.daysLeft < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {trial.date} {trial.daysLeft >= 0 ? `(${trial.daysLeft}d)` : '(expirado)'}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Registado</p>
                <p className="font-medium">{fmtDatetime(conta.criado_em)}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground mb-0.5">Clerk ID</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{conta.clerk_user_id}</p>
              </div>
            </div>
          </div>

          {/* Propriedades */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Propriedades</h2>
            </div>
            {!propriedades?.length ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma propriedade.</p>
            ) : (
              <ul className="divide-y divide-border">
                {propriedades.map(p => (
                  <li key={p.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.tipo} · {p.cidade}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.ativo
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {p.ativo ? 'Activa' : 'Inactiva'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reservas recentes */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold">Reservas recentes</h2>
            </div>
            {!reservas?.length ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">Nenhuma reserva.</p>
            ) : (
              <ul className="divide-y divide-border">
                {reservas.map(r => (
                  <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{r.check_in} → {r.check_out}</p>
                      <p className="text-sm font-medium mt-0.5">
                        {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(r.preco_total)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{r.estado}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ── Coluna lateral — Edição ── */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-5">Editar conta</h2>
            <EditAccountForm account={conta} />
          </div>

          {/* Acções rápidas */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3">Ligações rápidas</h2>
            <div className="space-y-2">
              <a
                href={`https://dashboard.clerk.com/users/${conta.clerk_user_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Ver no Clerk Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

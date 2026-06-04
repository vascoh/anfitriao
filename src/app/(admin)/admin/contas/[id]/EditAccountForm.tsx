'use client'

import { useTransition, useRef } from 'react'
import { toast } from 'sonner'
import { updateAccountAction } from './actions'
import type { Account } from '@/lib/accounts'

const ESTADOS = [
  { value: 'trial',     label: 'Trial' },
  { value: 'activo',   label: 'Activo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'cancelado',label: 'Cancelado' },
]

const PLANOS = [
  { value: 'trial',   label: 'Trial (sem plano pago)' },
  { value: 'starter', label: 'Starter — €19/mês' },
  { value: 'pro',     label: 'Pro — €39/mês' },
]

export function EditAccountForm({ account }: { account: Account }) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateAccountAction(account.id, formData)
        toast.success('Conta actualizada.')
      } catch {
        toast.error('Erro ao actualizar a conta.')
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

      {/* Estado */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Estado
        </label>
        <select
          name="estado"
          defaultValue={account.estado}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {ESTADOS.map(e => (
            <option key={e.value} value={e.value}>{e.label}</option>
          ))}
        </select>
      </div>

      {/* Plano */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Plano
        </label>
        <select
          name="plano"
          defaultValue={account.plano}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {PLANOS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Limite de propriedades */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Limite de propriedades
        </label>
        <input
          type="number"
          name="propriedades_max"
          defaultValue={account.propriedades_max}
          min={1}
          max={100}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Notas internas */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
          Notas internas
        </label>
        <textarea
          name="notas_admin"
          defaultValue={account.notas_admin ?? ''}
          rows={3}
          placeholder="Notas visíveis apenas para o admin…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isPending ? 'A guardar…' : 'Guardar alterações'}
      </button>
    </form>
  )
}

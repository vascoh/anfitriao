import Link from 'next/link'

export default function ContaSuspensaPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* Ícone */}
        <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Conta suspensa</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          O teu último pagamento não foi processado com sucesso.
          Actualiza o método de pagamento para continuar a usar o Anfitrião.
        </p>

        {/* Acções */}
        <div className="flex flex-col gap-3">
          <a
            href="/api/stripe/portal"
            className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Actualizar método de pagamento →
          </a>
          <Link
            href="/conta/billing"
            className="w-full rounded-xl border border-border py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Ver subscrição
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Precisas de ajuda?{' '}
          <a href="mailto:suporte@anfitrioes.pt" className="underline hover:text-foreground">
            Contacta o suporte
          </a>
        </p>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

/** Layout partilhado pelas páginas legais (privacidade/cookies/termos). */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-12 flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="flex flex-col gap-4 text-sm text-muted-foreground leading-relaxed [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-base [&_h2]:mt-2 [&_strong]:text-foreground">
        {children}
      </div>
      <p className="text-[11px] text-muted-foreground/70 pt-6 border-t border-border mt-4">
        Este texto é um modelo genérico gerado automaticamente. O anfitrião é responsável por o rever e adaptar às suas condições específicas.
      </p>
    </main>
  )
}

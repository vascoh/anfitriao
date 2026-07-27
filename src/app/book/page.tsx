import Link from 'next/link'

/**
 * Rota legada de quando a app era single-tenant: mostrava todos os
 * alojamentos de todos os anfitriões numa única listagem. Removida
 * (2026-07-26) por ler diretamente `db.getProperties()`/`db.getWebsiteSettings()`
 * sem filtro de owner_id — expunha alojamentos de todos os inquilinos a
 * qualquer visitante anónimo. Cada anfitrião tem agora o seu site próprio em
 * `/r/[slug]`; esta rota fica só como destino seguro para links antigos.
 */
export default function BookPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Alojamento não encontrado</h1>
      <p className="text-muted-foreground text-sm max-w-sm">
        O link que seguiste pode estar desatualizado. Cada anfitrião tem o seu próprio site de reservas —
        contacta-o diretamente ou visita a página inicial.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">← Página inicial</Link>
    </div>
  )
}

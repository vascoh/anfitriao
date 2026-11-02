import type { Metadata } from 'next'
import { EquipaLimpezas } from './equipa-limpezas'

export const metadata: Metadata = {
  title: 'Limpezas',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <EquipaLimpezas token={token} />
}

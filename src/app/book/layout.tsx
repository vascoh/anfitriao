import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Reservas Diretas',
  description: 'Reserve diretamente, sem intermediários.',
}

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

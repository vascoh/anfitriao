import { Inter } from 'next/font/google'
import { Footer } from '@/components/landing-v2/footer'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`${inter.variable} landing-v2 min-h-dvh bg-slate-900 text-slate-100`}>
      <main>{children}</main>
      <Footer />
    </div>
  )
}

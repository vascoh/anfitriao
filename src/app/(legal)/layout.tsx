import { Footer } from '@/components/landing-v2/footer'

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="landing min-h-dvh bg-background text-foreground">
      <main>{children}</main>
      <Footer />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { SmoothScroll } from '@/components/landing-v2/smooth-scroll'
import { Header } from '@/components/landing-v2/header'
import { Hero } from '@/components/landing-v2/hero'
import { ProblemSolution } from '@/components/landing-v2/problem-solution'
import { Features } from '@/components/landing-v2/features'
import { DashboardPreview } from '@/components/landing-v2/dashboard-preview'
import { Calculadora } from '@/components/landing-v2/calculadora'
import { Pricing } from '@/components/landing-v2/pricing'
import { Testimonials } from '@/components/landing-v2/testimonials'
import { FAQ } from '@/components/landing-v2/faq'
import { PERGUNTAS } from '@/components/landing-v2/faq-data'
import { CTASection } from '@/components/landing-v2/cta-section'
import { Footer } from '@/components/landing-v2/footer'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Anfitrião — Gestão de Alojamento Local sem papelada',
  description:
    'Airbnb e Booking.com num só calendário. Propriedades, reservas e hóspedes num único lugar, com check-in online e o boletim do SIBA pronto antes da chegada. Feito em Portugal, para a lei portuguesa.',
  alternates: {
    canonical: '/',
  },
}

// FAQPage structured data — derivado de faq-data.ts para nunca divergir do acordeão
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: PERGUNTAS.map((item) => ({
    '@type': 'Question',
    name: item.pergunta,
    acceptedAnswer: { '@type': 'Answer', text: item.resposta },
  })),
}

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/hoje')

  return (
    <div className={`${inter.variable} landing-v2 min-h-dvh bg-slate-900 text-slate-100`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SmoothScroll />

      <a
        href="#conteudo"
        className="sr-only rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-slate-950 focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-100"
      >
        Saltar para o conteúdo
      </a>

      <Header />
      <main id="conteudo">
        <Hero />
        <ProblemSolution />
        <Features />
        <DashboardPreview />
        <Calculadora />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  )
}

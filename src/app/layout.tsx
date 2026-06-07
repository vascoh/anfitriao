import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt'

const OG_IMAGE = `${APP_URL}/api/og`

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Anfitrião — Gestão de Alojamento Local',
    template: '%s · Anfitrião',
  },
  description: 'Sincroniza Airbnb e Booking.com, faz check-in online legal, acompanha reservas e receitas. O assistente de Alojamento Local feito para Portugal.',
  keywords: [
    'alojamento local', 'AL Portugal', 'gestão AL', 'airbnb gestão',
    'booking gestão', 'SIBA SEF', 'check-in online', 'reservas diretas',
    'gestão alojamento local portugal', 'software alojamento local',
  ],
  authors: [{ name: 'Anfitrião' }],
  creator: 'Anfitrião',
  publisher: 'Anfitrião',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Anfitrião',
  },
  icons: {
    apple: '/api/pwa-icon?size=180',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    url: APP_URL,
    siteName: 'Anfitrião',
    title: 'Anfitrião — Gestão de Alojamento Local sem stress',
    description: 'Sincroniza Airbnb e Booking.com, faz check-in online legal e acompanha reservas. Feito para anfitriões portugueses.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Anfitrião — Gestão de Alojamento Local' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anfitrião — Gestão de Alojamento Local sem stress',
    description: 'Sincroniza Airbnb e Booking.com, faz check-in online legal e acompanha reservas. Feito para anfitriões portugueses.',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: APP_URL,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#C2714F',
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Anfitrião',
  url: APP_URL,
  description: 'Gestão de Alojamento Local para anfitriões portugueses. Sincroniza Airbnb e Booking.com, check-in online SIBA, relatórios e IA Concierge.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'pt-PT',
  offers: [
    { '@type': 'Offer', name: 'Trial', price: '0', priceCurrency: 'EUR', description: '14 dias grátis, sem cartão de crédito' },
    { '@type': 'Offer', name: 'Starter', price: '19', priceCurrency: 'EUR', description: 'Até 3 propriedades, reservas ilimitadas' },
    { '@type': 'Offer', name: 'Pro', price: '39', priceCurrency: 'EUR', description: 'Até 10 propriedades, relatórios avançados' },
  ],
  provider: {
    '@type': 'Organization',
    name: 'Anfitrião',
    url: APP_URL,
    contactPoint: { '@type': 'ContactPoint', email: 'suporte@anfitrioes.pt', contactType: 'customer support', availableLanguage: 'Portuguese' },
  },
}

// Inline script to apply theme before first paint (prevents flash)
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('anf:theme') || 'system';
      var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) document.documentElement.classList.add('dark');
    } catch(e) {}
  })();
`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html
        lang="pt"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        {/* eslint-disable-next-line react/no-danger */}
        <head>
          <link rel="preconnect" href="https://clerk.anfitrioes.pt" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://nnbqfrszukkzoqwssjvg.supabase.co" />
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="h-full bg-background text-foreground">
          {children}
          <PwaRegister />
        </body>
      </html>
    </ClerkProvider>
  )
}

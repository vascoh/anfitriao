import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { PwaRegister } from '@/components/pwa-register'
import './globals.css'
import { APP_URL } from '@/lib/config'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})


const OG_IMAGE = `${APP_URL}/api/og`

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Anfitrião — Gestão de Alojamento Local',
    template: '%s · Anfitrião',
  },
  description: 'Airbnb e Booking.com num só calendário, check-in online e boletim SIBA pronto antes da chegada. O assistente de Alojamento Local feito para Portugal.',
  keywords: [
    'alojamento local', 'AL Portugal', 'gestão AL', 'airbnb gestão',
    'booking gestão', 'SIBA AIMA', 'check-in online', 'reservas diretas',
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
    title: 'Anfitrião — Gestão de Alojamento Local sem papelada',
    description: 'Airbnb e Booking.com num só calendário, check-in online e boletim SIBA pronto antes da chegada. Feito para anfitriões portugueses.',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Anfitrião — Gestão de Alojamento Local' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Anfitrião — Gestão de Alojamento Local sem papelada',
    description: 'Airbnb e Booking.com num só calendário, check-in online e boletim SIBA pronto antes da chegada. Feito para anfitriões portugueses.',
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
  // sem maximumScale: bloquear o zoom viola WCAG 1.4.4 (axe: meta-viewport)
  viewportFit: 'cover',
  themeColor: '#C2714F',
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
        <head>
          <link rel="preconnect" href="https://clerk.anfitrioes.pt" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="dns-prefetch" href="https://nnbqfrszukkzoqwssjvg.supabase.co" />
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="h-full bg-background text-foreground">
          {children}
          <PwaRegister />
        </body>
      </html>
    </ClerkProvider>
  )
}

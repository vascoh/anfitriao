import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  // Landing page de marketing
  '/',
  // Página de manutenção — acessível a todos (não cria loop de redirect)
  '/em-construcao',
  // Website público de reservas
  '/book(.*)',
  '/r/(.*)',
  // Check-in online do hóspede
  '/checkin(.*)',
  // Auth
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/(auth)(.*)',
  // APIs públicas
  '/api/book',
  '/api/og(.*)',
  '/api/ical(.*)',
  '/api/ical-proxy(.*)',
  '/api/checkin/(.*)',
  '/api/pwa-icon(.*)',
  '/api/notify-confirmation(.*)',
  '/api/notify-checkin-complete(.*)',
  '/api/stripe/webhook', // webhook verificado pela assinatura Stripe
  // Cron jobs (protegidos por CRON_SECRET, não por Clerk)
  '/api/ical-sync(.*)',
  '/api/cron/(.*)',
  // PWA
  '/manifest.json',
  '/icons(.*)',
])

// Rotas acessíveis mesmo com conta suspensa/cancelada/expirada
const isAccountRoute = createRouteMatcher([
  '/conta/(.*)',
  '/api/stripe/(.*)',
  '/api/og(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // 1. Rotas públicas passam sempre
  if (isPublicRoute(req)) return

  // 2. Sem sessão → Clerk redireciona para sign-in
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    await auth.protect()
    return
  }

  // 3. Admin bypassa todo o enforcement
  if (userId === process.env.ADMIN_USER_ID) return

  // 4. Maintenance mode — só o admin pode aceder ao app
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Conta/billing/stripe ficam acessíveis (utilizador pode gerir subscrição)
    if (isAccountRoute(req)) return
    return NextResponse.redirect(new URL('/em-construcao', req.url))
  }

  // 5. Rotas de conta/billing/stripe passam sempre
  if (isAccountRoute(req)) return

  // 5. Enforcement de estado — lê do JWT (sem DB call)
  // Clerk inclui publicMetadata em sessionClaims.metadata por defeito (SDK v5+)
  const meta = (sessionClaims as Record<string, unknown> | null)
    ?.metadata as { estado?: string; trial_ends_at?: string } | undefined

  const estado = meta?.estado

  if (estado === 'suspenso') {
    return NextResponse.redirect(new URL('/conta/suspensa', req.url))
  }

  if (estado === 'cancelado') {
    return NextResponse.redirect(new URL('/conta/billing', req.url))
  }

  if (estado === 'trial' && meta?.trial_ends_at) {
    const expired = new Date(meta.trial_ends_at) < new Date()
    if (expired) {
      return NextResponse.redirect(new URL('/conta/billing', req.url))
    }
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

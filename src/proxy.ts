import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

const ROTAS_SITE = [
  '/', '/sobre', '/galeria', '/localizacao', '/blog', '/privacidade', '/cookies', '/termos', '/sitemap.xml',
]

function hostname(req: NextRequest): string {
  return (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0].trim().split(':')[0].toLowerCase()
}

function hostDaPlataforma(host: string): boolean {
  let principal = 'anfitrioes.pt'
  try { principal = new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt').hostname }
  catch { /* usa a origem de produção */ }
  return !host || host === 'localhost' || host === principal || host.endsWith(`.${principal}`) ||
    host === 'anfitrioes.pt' || host.endsWith('.anfitrioes.pt') || host.endsWith('.vercel.app')
}

async function encaminharDominioProprio(req: NextRequest) {
  const host = hostname(req)
  if (hostDaPlataforma(host)) return null

  const supabase = createAdminClient()
  const { data: associacao, error } = await supabase
    .from('custom_domains')
    .select('owner_id')
    .eq('dominio', host)
    .maybeSingle()
  if (error || !associacao?.owner_id) return null

  // O slug pode ser alterado nas definições do site. Lê-lo na fonte evita
  // deixar um domínio preso ao endereço antigo.
  const { data: site } = await supabase
    .from('website_settings')
    .select('slug')
    .eq('owner_id', associacao.owner_id)
    .maybeSingle()
  if (!site?.slug) return null

  const path = req.nextUrl.pathname
  const prefixoInterno = `/r/${site.slug}`
  if (path === prefixoInterno || path.startsWith(`${prefixoInterno}/`)) {
    const limpo = path.slice(prefixoInterno.length) || '/'
    return NextResponse.redirect(new URL(`${limpo}${req.nextUrl.search}`, req.url), 308)
  }

  const rotaDoSite = ROTAS_SITE.includes(path) || path.startsWith('/blog/') || path.startsWith('/p/')
  if (!rotaDoSite) return null

  const destino = req.nextUrl.clone()
  destino.pathname = path === '/sitemap.xml'
    ? `${prefixoInterno}/sitemap.xml`
    : `${prefixoInterno}${path === '/' ? '' : path}`
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-anfitriao-custom-domain', host)
  requestHeaders.set('x-anfitriao-site-slug', site.slug)
  return NextResponse.rewrite(destino, { request: { headers: requestHeaders } })
}

const isPublicRoute = createRouteMatcher([
  // Landing page de marketing
  '/',
  // Páginas legais — têm de ser acessíveis sem sessão
  '/termos',
  '/privacidade',
  '/cookies',
  // Páginas de comparação com concorrentes (SEO de alta intenção)
  '/vs(.*)',
  // Página de manutenção — acessível a todos (não cria loop de redirect)
  '/em-construcao',
  // Website público de reservas
  '/book(.*)',
  '/r/(.*)',
  // SEO — bug pré-existente: nunca estiveram na lista pública, o Clerk
  // bloqueava-os (404 disfarçado), o Google nunca conseguiu lê-los
  '/robots.txt',
  '/sitemap.xml',
  // Check-in online do hóspede
  '/checkin(.*)',
  // Auth
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/(auth)(.*)',
  // APIs públicas
  '/api/book',
  '/api/book/grupo',
  '/api/book/checkout',
  '/api/book-checkout-fulfill',
  '/api/og(.*)',
  // Subscrição da newsletter na landing page (rate-limited na base)
  '/api/newsletter',
  '/api/ical/(.*)',
  '/api/checkin/(.*)',
  '/api/book-confirmation/(.*)',
  '/api/pwa-icon(.*)',
  // Extração de documento usada pelo check-in público do hóspede (rate-limited)
  '/api/documentos/extrair',
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
  const dominioProprio = await encaminharDominioProprio(req)
  if (dominioProprio) return dominioProprio

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

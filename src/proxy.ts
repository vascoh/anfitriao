import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
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
    ? `${prefixoInterno}/sitemap`
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
  // Caixa de entrada: respostas por email (assinatura Svix do Resend) e
  // WhatsApp (assinatura da app Meta de cada anfitrião). Rate-limited.
  '/api/mensagens/entrada/(.*)',
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

/* O sitemap de cada site vive em `/r/<slug>/sitemap`. Em `/r/<slug>/sitemap.xml`
 * (uma pasta com `.xml` no nome) a rota existia no build mas a Vercel servia
 * sempre a página 404 — e era esse o endereço que o robots.txt dava ao Google.
 * O endereço antigo continua a responder, encaminhado para o novo. */
const SITEMAP_ANTIGO = /^\/r\/([^/]+)\/sitemap\.xml$/

/** Páginas que só hóspedes visitam: o site do anfitrião, a reserva e o check-in. */
const PAGINAS_DE_HOSPEDE = /^\/(?:r|book|checkin)(?:\/|$)/

/** O pedido traz uma sessão Clerk (ou o sinal de que o browser já teve uma). */
export function temSessaoClerk(req: NextRequest): boolean {
  const uat = req.cookies.get('__client_uat')?.value
  return Boolean(req.cookies.get('__session')?.value) || (uat !== undefined && uat !== '' && uat !== '0')
}

const comClerk = clerkMiddleware(async (auth, req) => {
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

/**
 * Um hóspede sem sessão não passa pelo Clerk.
 *
 * Com o Clerk na instância de desenvolvimento, o middleware fazia a cada
 * visitante novo um «handshake» (`dev-browser-missing`): redirecionava para
 * clerk.accounts.dev e de volta antes de servir a página — dois saltos de rede
 * no site do anfitrião, para alguém que nunca vai iniciar sessão. Medido em
 * /r/casadevasco a 2026-10-07. Numa instância de produção o salto desaparece,
 * mas continua a não haver razão para o site público depender do Clerk.
 *
 * Quem tem sessão (o anfitrião a ver o próprio site no editor) passa pelo
 * Clerk como antes, e é por isso que `auth()` ainda o reconhece como dono.
 * Sem Clerk, `eDonoDoSite` responde «não» — que é a resposta certa.
 */
export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  const sitemapAntigo = req.nextUrl.pathname.match(SITEMAP_ANTIGO)
  if (sitemapAntigo) {
    const destino = req.nextUrl.clone()
    destino.pathname = `/r/${sitemapAntigo[1]}/sitemap`
    return NextResponse.rewrite(destino)
  }

  // Domínio próprio: só hóspedes (a sessão da plataforma não chega lá).
  const dominioProprio = await encaminharDominioProprio(req)
  if (dominioProprio) return dominioProprio

  if (PAGINAS_DE_HOSPEDE.test(req.nextUrl.pathname) && !temSessaoClerk(req)) {
    return NextResponse.next()
  }

  return comClerk(req, ev)
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

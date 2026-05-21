import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that REQUIRE auth — everything else is excluded from the matcher
// to avoid the Clerk dev-handshake hang on non-localhost domains.
const isProtectedRoute = createRouteMatcher([
  '/hoje(.*)',
  '/reservas(.*)',
  '/calendario(.*)',
  '/hospedes(.*)',
  '/propriedades(.*)',
  '/precos(.*)',
  '/relatorios(.*)',
  '/concierge(.*)',
  '/website(.*)',
  '/documentos(.*)',
  '/api/concierge(.*)',
  '/api/documentos(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Run only on routes that need auth (protected app routes + sign-in flow)
    '/(hoje|reservas|calendario|hospedes|propriedades|precos|relatorios|concierge|website|documentos|sign-in)(.*)',
    '/api/(concierge|documentos)(.*)',
  ],
}

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Exclude Next.js internals, static files, public booking flow (/book, /checkin)
    // and their API counterparts so Clerk dev handshake doesn't intercept them
    '/((?!_next|book|checkin|api/checkin|api/ical|api/ical-proxy|api/ical-sync|api/notify|api/cron|api/pwa-icon|api/documentos|sw\\.js|manifest\\.json|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}

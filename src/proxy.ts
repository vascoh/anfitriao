import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  // Public booking site (legacy /book + tenant slug path /r/[slug])
  '/book(.*)',
  '/r/(.*)',
  // Guest online check-in flow
  '/checkin(.*)',
  // Auth pages
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/(auth)(.*)',
  // Public APIs
  '/api/ical(.*)',
  '/api/ical-proxy(.*)',
  '/api/checkin/(.*)',
  '/api/pwa-icon(.*)',
  '/api/notify-booking(.*)',
  '/api/notify-confirmation(.*)',
  '/api/notify-checkin-complete(.*)',
  // Cron jobs (protected by CRON_SECRET, not by Clerk)
  '/api/ical-sync(.*)',
  '/api/cron/(.*)',
  // PWA resources
  '/manifest.json',
  '/icons(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

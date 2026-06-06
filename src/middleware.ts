import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Routes accessible without authentication
const isPublicRoute = createRouteMatcher([
  '/em-construcao',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/r/(.*)',
  '/book/(.*)',
  '/checkin/(.*)',
  '/api/ical/(.*)',
  '/api/ical-proxy(.*)',
  '/api/stripe/webhook',
  '/api/properties',
])

// Routes that must always stay open regardless of maintenance mode
const isAlwaysOpen = createRouteMatcher([
  '/api/stripe/webhook',
  '/api/ical/(.*)',
  '/api/ical-proxy(.*)',
  '/api/ical-sync',
])

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // Always allow webhook and ical routes — no auth or maintenance checks
  if (isAlwaysOpen(req)) return NextResponse.next()

  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true'

  if (maintenanceMode) {
    const { userId } = await auth()
    const adminId = process.env.ADMIN_USER_ID
    const isAdmin = Boolean(userId && adminId && userId === adminId)

    // Admin bypasses maintenance mode entirely
    if (!isAdmin) {
      // Allow sign-in so admin can authenticate
      if (!isPublicRoute(req)) {
        return NextResponse.redirect(new URL('/em-construcao', req.url))
      }
      // Also redirect landing page to construction page
      if (pathname === '/') {
        return NextResponse.redirect(new URL('/em-construcao', req.url))
      }
    }
  }

  // Protect all non-public routes — requires Clerk authentication
  if (!isPublicRoute(req) && pathname !== '/') {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

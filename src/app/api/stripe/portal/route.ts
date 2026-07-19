import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { getAccountByClerkId } from '@/lib/accounts'
import { APP_URL } from '@/lib/config'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const account = await getAccountByClerkId(userId)
  if (!account?.stripe_customer_id) {
    return NextResponse.redirect(
      new URL('/conta/billing', APP_URL)
    )
  }

  const baseUrl = APP_URL

  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${baseUrl}/conta/billing`,
  })

  return NextResponse.redirect(session.url)
}

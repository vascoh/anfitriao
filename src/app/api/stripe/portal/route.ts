import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { getAccountByClerkId } from '@/lib/accounts'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const account = await getAccountByClerkId(userId)
  if (!account?.stripe_customer_id) {
    return NextResponse.redirect(
      new URL('/conta/billing', process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitriao-nine.vercel.app')
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitriao-nine.vercel.app'

  const session = await stripe.billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${baseUrl}/conta/billing`,
  })

  return NextResponse.redirect(session.url)
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe, priceToPlano } from '@/lib/stripe'
import { getAccountByClerkId, updateAccount } from '@/lib/accounts'
import { APP_URL } from '@/lib/config'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { priceId } = await req.json() as { priceId: string }
  const allowedPriceIds = [process.env.STRIPE_STARTER_PRICE_ID, process.env.STRIPE_PRO_PRICE_ID].filter(Boolean)
  if (!priceId || !allowedPriceIds.includes(priceId)) {
    return NextResponse.json({ error: 'priceId inválido' }, { status: 400 })
  }

  const account = await getAccountByClerkId(userId)
  if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  const baseUrl = APP_URL
  const plano = priceToPlano(priceId)

  // Criar ou reutilizar cliente Stripe
  let customerId = account.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: account.email,
      name: account.nome ?? undefined,
      metadata: {
        clerk_user_id: account.clerk_user_id,
        account_id: account.id,
      },
    })
    customerId = customer.id
    await updateAccount(account.id, { stripe_customer_id: customerId })
  }

  // Criar sessão de checkout
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/conta/bem-vindo?plano=${plano}`,
    cancel_url:  `${baseUrl}/conta/billing?cancelled=1`,
    allow_promotion_codes: true,
    metadata: { account_id: account.id },
    subscription_data: {
      metadata: { account_id: account.id },
    },
  })

  return NextResponse.json({ url: session.url })
}

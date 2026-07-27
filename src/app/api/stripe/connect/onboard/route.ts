import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getAccountByClerkId, updateAccount } from '@/lib/accounts'
import { createConnectAccount, createOnboardingLink } from '@/lib/stripe-connect'

/**
 * POST /api/stripe/connect/onboard
 * Cria (se necessário) a conta Stripe Connect Express do anfitrião e devolve
 * o link de onboarding alojado pela Stripe. O anfitrião preenche os dados
 * bancários/identificação diretamente na Stripe — a Anfitrião nunca vê nem
 * guarda esses dados.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const account = await getAccountByClerkId(userId)
  if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

  let connectAccountId = account.stripe_connect_account_id
  if (!connectAccountId) {
    connectAccountId = await createConnectAccount(account.email)
    await updateAccount(account.id, { stripe_connect_account_id: connectAccountId })
  }

  const url = await createOnboardingLink(connectAccountId)
  return NextResponse.json({ url })
}

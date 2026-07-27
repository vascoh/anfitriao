'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { updateAccount } from '@/lib/accounts'
import type { AccountEstado, AccountPlano } from '@/lib/accounts'

export async function updateAccountAction(id: string, formData: FormData) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    throw new Error('Acesso negado')
  }

  const estado = formData.get('estado') as AccountEstado
  const plano = formData.get('plano') as AccountPlano
  const propriedades_max = Number(formData.get('propriedades_max'))
  const notas_admin = (formData.get('notas_admin') as string) || null

  await updateAccount(id, { estado, plano, propriedades_max, notas_admin }, userId)

  revalidatePath(`/admin/contas/${id}`)
  revalidatePath('/admin/contas')
}

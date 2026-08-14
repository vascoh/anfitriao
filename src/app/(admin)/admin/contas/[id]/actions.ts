'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { updateAccount } from '@/lib/accounts'
import type { AccountEstado, AccountPlano } from '@/lib/accounts'

const ESTADOS: AccountEstado[] = ['trial', 'activo', 'suspenso', 'cancelado']
const PLANOS: AccountPlano[] = ['trial', 'starter', 'pro', 'empresa']

export async function updateAccountAction(id: string, formData: FormData) {
  const { userId } = await auth()
  if (!userId || userId !== process.env.ADMIN_USER_ID) {
    throw new Error('Acesso negado')
  }

  /* Validar o que vem do formulário, mesmo sendo o formulário nosso.
   *
   * `estado` e `plano` iam para a base como texto livre, e a coluna não tem
   * restrição nenhuma: um valor fora do conjunto ficava lá gravado e a app
   * passava a comparar contra uma palavra que não existe — uma conta em
   * estado que nenhum ramo do código trata. `propriedades_max` vinha de um
   * `Number()` que aceita NaN. */
  const estado = formData.get('estado') as AccountEstado
  const plano = formData.get('plano') as AccountPlano
  if (!ESTADOS.includes(estado)) throw new Error(`Estado inválido: ${estado}`)
  if (!PLANOS.includes(plano)) throw new Error(`Plano inválido: ${plano}`)

  const max = Number(formData.get('propriedades_max'))
  if (!Number.isInteger(max) || max < 0 || max > 500) {
    throw new Error('Número de unidades inválido (0 a 500).')
  }

  const notas_admin = (formData.get('notas_admin') as string) || null

  await updateAccount(id, { estado, plano, propriedades_max: max, notas_admin }, userId)

  revalidatePath(`/admin/contas/${id}`)
  revalidatePath('/admin/contas')
}

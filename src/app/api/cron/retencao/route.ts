import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cron-auth'
import { aplicarRetencao } from '@/lib/retencao-server'

/**
 * Cron: aplica a política de retenção (ANF-1.10). Diário às 03:00, antes do
 * ical-sync — é a única rotina que apaga dados, e convém não competir com as
 * que escrevem.
 *
 * Não notifica ninguém de propósito. Apagar o que já não pode ser conservado é
 * o comportamento normal e prometido na política de privacidade, não um evento
 * — quem quiser confirmar tem o `audit_log`, onde fica registada cada
 * anonimização. As regras e prazos vivem em `lib/retencao.ts`.
 */
export async function GET(req: NextRequest) {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const resultado = await aplicarRetencao()

  if (resultado.anonimizados > 0 || resultado.erros > 0) {
    console.log(
      `[retencao] avaliados=${resultado.avaliados} anonimizados=${resultado.anonimizados} erros=${resultado.erros}`,
    )
  }

  return NextResponse.json({ ok: true, ...resultado })
}

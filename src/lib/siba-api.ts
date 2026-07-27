import 'server-only'
import type { SibaBookingRow } from './siba'

/**
 * Cliente para submissão automática de boletins de alojamento à AIMA (ex-SEF).
 *
 * ⚠️ PLACEHOLDER: a AIMA não tem, à data desta implementação (2026-07-27),
 * especificação técnica pública confirmada para este projeto (endpoint,
 * esquema de autenticação, formato do payload). Este ficheiro define a
 * interface/contrato que o resto da aplicação usa (`submitBookingToSiba`),
 * para que ligar a chamada real seja uma alteração isolada a este ficheiro
 * assim que a AIMA fornecer credenciais + documentação de entidade.
 *
 * Enquanto não configurado, `isSibaApiConfigured()` devolve false e a rota
 * `/api/siba-submit` responde 501 — a exportação CSV manual (`lib/siba.ts`,
 * `/api/siba-export`) continua a ser o caminho suportado.
 */

export interface SibaSubmissionResult {
  success: boolean
  /** Referência/protocolo devolvido pela AIMA, se houver sucesso. */
  reference?: string
  error?: string
}

/** True quando as credenciais da API SIBA/AIMA estão configuradas no ambiente. */
export function isSibaApiConfigured(): boolean {
  return Boolean(process.env.SIBA_API_URL && process.env.SIBA_API_KEY)
}

/**
 * Submete um boletim de alojamento à AIMA.
 *
 * TODO (bloqueado por credenciais/documentação AIMA): substituir o corpo
 * desta função pela chamada HTTP real assim que houver acesso de entidade.
 * Manter a assinatura (`SibaBookingRow` → `SibaSubmissionResult`) para não
 * obrigar a mexer nos consumidores (`/api/siba-submit`).
 */
export async function submitBookingToSiba(_row: SibaBookingRow): Promise<SibaSubmissionResult> {
  if (!isSibaApiConfigured()) {
    return { success: false, error: 'Integração SIBA/AIMA não configurada (SIBA_API_URL/SIBA_API_KEY em falta).' }
  }

  // Nunca deveria chegar aqui sem uma implementação real associada às env vars.
  return { success: false, error: 'Cliente SIBA/AIMA configurado mas por implementar — contacta o suporte técnico.' }
}

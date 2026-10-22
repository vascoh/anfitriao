import type { CanalMensagem, Conversa, Mensagem } from '@/lib/mensagens'
import type { ValoresVariaveis } from '@/lib/respostas-guardadas'
import { addDays } from '@/lib/utils'

/** Linha da lista de conversas, como `/api/mensagens` a devolve. */
export interface ConversaLista extends Conversa {
  nome: string
  propriedade: string | null
  check_in: string | null
  check_out: string | null
}

/** Conversa aberta, como `/api/mensagens?reserva=` a devolve. */
export interface ConversaAberta {
  mensagens: Mensagem[]
  reserva: { id: string; check_in: string; check_out: string; estado: string } | null
  propriedade: string | null
  variaveis: ValoresVariaveis
  hospede: { id: string; nome: string } | null
  contactos: { email: string | null; telefone: string | null }
  capacidades: {
    email: boolean
    whatsappApi: boolean
    whatsappJanela: boolean
    whatsappLink: boolean
    respostasPorEmail: boolean
  }
}

/** Que conversa está aberta: uma reserva, ou um contacto sem reserva. */
export type Selecao =
  | { reserva: string }
  | { canal: CanalMensagem; contacto: string }

export function selecaoParaQuery(s: Selecao): string {
  return 'reserva' in s
    ? `reserva=${encodeURIComponent(s.reserva)}`
    : `canal=${encodeURIComponent(s.canal)}&contacto=${encodeURIComponent(s.contacto)}`
}

export function selecaoDaConversa(c: Pick<Conversa, 'reserva_id' | 'canal' | 'contacto'>): Selecao | null {
  if (c.reserva_id) return { reserva: c.reserva_id }
  return c.contacto ? { canal: c.canal, contacto: c.contacto } : null
}

/** «14:05» se for hoje, «ontem», «3 out.» antes disso. */
export function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const dia = (x: Date) => {
    const partes = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Lisbon',
    }).formatToParts(x)
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === tipo)?.value ?? ''
    return `${valor('year')}-${valor('month')}-${valor('day')}`
  }
  const hoje = dia(agora)
  if (dia(d) === hoje) {
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
  }
  // Um dia civil não tem sempre 24 horas: na mudança para a hora de inverno,
  // subtrair 86 400 000 ms ainda pode cair no mesmo dia em Lisboa.
  if (dia(d) === addDays(hoje, -1)) return 'ontem'
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', timeZone: 'Europe/Lisbon' })
}

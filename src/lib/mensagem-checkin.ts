import { fmtDate, nights } from './utils'

/**
 * O convite ao check-in online, num só sítio.
 *
 * Usado pelo botão do WhatsApp (quando há telefone) e pela partilha nativa do
 * telemóvel (quando não há — o caso normal de uma reserva do Airbnb ou do
 * Booking, em que o anfitrião só fala com o hóspede pela app da plataforma).
 * O link é o que o hóspede abre; tudo o resto é contexto para ele confiar nele.
 */
export function mensagemDeCheckin(d: {
  nome?: string | null
  alojamento: string
  checkIn: string
  checkOut: string
  instrucoes?: string | null
  link: string
}): string {
  const n = nights(d.checkIn, d.checkOut)
  const data = fmtDate(d.checkIn, { weekday: 'long', day: 'numeric', month: 'long' })
  const primeiro = d.nome?.trim().split(/\s+/)[0]
  const ola = primeiro ? `Olá ${primeiro}!` : 'Olá!'
  const instrucoes = d.instrucoes?.trim() ? `\n\n${d.instrucoes.trim()}` : ''
  return (
    `${ola} A sua reserva em ${d.alojamento} está confirmada para ${data} (${n} noite${n !== 1 ? 's' : ''}).` +
    `${instrucoes}\n\nPor favor, faça o seu check-in online antes da chegada (1 minuto): ${d.link}\n\nBem-vindo/a!`
  )
}

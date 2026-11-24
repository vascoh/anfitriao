/**
 * O código da reserva que o Airbnb põe no seu feed iCal.
 *
 * O export do Airbnb (Anúncio → Disponibilidade → Sincronizar calendários →
 * Exportar) é o único feed de plataforma que diz alguma coisa sobre a reserva:
 *
 *   SUMMARY:Reserved
 *   DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC12345\n
 *    Phone Number (Last 4 Digits): 1234
 *
 * Dali só se tira o **código** (`HM…`). É o que permite, em `/reservas/[id]` e
 * em `/hoje`, um «Abrir no Airbnb» que leva direto à reserva — onde está o nome
 * do hóspede, a conversa e o sítio para lhe mandar o link do check-in. Sem
 * isto, o anfitrião procura a reserva à mão pelas datas.
 *
 * O resto não se guarda, de propósito: os 4 dígitos do telefone são dado
 * pessoal e não servem para nada que o código não faça melhor (ANF-1.8).
 *
 * O Booking e o Vrbo não publicam nada parecido — `CLOSED - Not available` e
 * pouco mais — e o Amenitiz publica disponibilidade, sem `DESCRIPTION`. Para
 * esses a função devolve `null` e nada muda.
 *
 * Extração conservadora: só um URL de reservas num domínio do Airbnb, e só um
 * código com a forma que eles usam. Se o formato mudar, deixa de se extrair —
 * nunca se extrai lixo para um link.
 */

const URL_DE_RESERVA =
  /https?:\/\/(?:www\.)?airbnb\.[a-z]{2,3}(?:\.[a-z]{2})?\/hosting\/reservations\/details\/([A-Za-z0-9]+)/i

/** Os códigos de confirmação do Airbnb: `HM` + 8 letras/dígitos. Há variações de comprimento ao longo dos anos. */
const CODIGO_AIRBNB = /^HM[A-Z0-9]{6,12}$/

export function referenciaDoAirbnb(description: string | null | undefined): string | null {
  if (!description) return null
  const m = URL_DE_RESERVA.exec(description)
  if (!m) return null
  const codigo = m[1].toUpperCase()
  return CODIGO_AIRBNB.test(codigo) ? codigo : null
}

/** Para onde leva o «Abrir no Airbnb». Só aceita um código que passe a mesma validação. */
export function urlDaReservaNaPlataforma(referencia: string | null | undefined): string | null {
  if (!referencia || !CODIGO_AIRBNB.test(referencia)) return null
  return `https://www.airbnb.pt/hosting/reservations/details/${referencia}`
}

/**
 * O que mostrar no lugar do nome numa reserva importada ainda sem hóspede.
 * «—» não diz nada; «Airbnb · HMQ4ZK8XYW» é o que o anfitrião procura na app
 * do Airbnb para saber quem chega.
 */
export function rotuloSemHospede(b: { referencia_externa?: string | null }): string {
  return b.referencia_externa ? `Airbnb · ${b.referencia_externa}` : '—'
}

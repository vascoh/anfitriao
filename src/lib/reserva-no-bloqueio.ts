import { eBloqueio } from './reservations'
import type { Booking } from './types'

/**
 * Uma reserva real dentro de um bloqueio importado.
 *
 * Enquanto o Amenitiz estiver entre o Anfitrião e as plataformas, as reservas
 * do Airbnb e do Booking chegam como «Quarto indisponível»: bloqueios sem
 * hóspede, às vezes várias reservas seguidas fundidas num só bloco. Sem isto
 * não havia forma de pôr um hóspede real no fluxo — check-in, boletim SIBA,
 * fatura: criar a reserva à mão nessas datas era recusado como conflito com o
 * próprio bloqueio, e a verificação ao vivo dizia «ocupado» (é ocupado —
 * por esta mesma reserva).
 *
 * A ligação (`bloqueio_id`) só vale se isto tudo for verdade, e é o servidor
 * que o verifica (`/api/bookings`):
 *  - o bloqueio existe, é do mesmo dono e do mesmo alojamento;
 *  - é mesmo um bloqueio (`eBloqueio`) e não está cancelado;
 *  - as datas da reserva cabem nas dele (pode haver várias lá dentro).
 *
 * Com isso, e só com isso, a sobreposição **com esse bloqueio** deixa de ser
 * conflito e não se pergunta às plataformas. Com as outras reservas continua a
 * ser — duas reservas no mesmo bloco não podem pisar-se.
 */

export type BloqueioParaValidar = Pick<
  Booking,
  'id' | 'propriedade_id' | 'owner_id' | 'check_in' | 'check_out' | 'estado' | 'hospede_id' | 'uid_externo' | 'notas' | 'origem' | 'bloqueio_id'
>

export type Validacao = { ok: true } | { ok: false; erro: string; status: number }

export function validarReservaNoBloqueio(
  bloqueio: BloqueioParaValidar | null,
  reserva: { propriedade_id: string; check_in: string; check_out: string },
  ownerId: string,
): Validacao {
  if (!bloqueio || bloqueio.owner_id !== ownerId) {
    return { ok: false, erro: 'O período a que esta reserva pertence já não existe.', status: 404 }
  }
  if (bloqueio.propriedade_id !== reserva.propriedade_id) {
    return { ok: false, erro: 'A reserva tem de ser no mesmo alojamento do período bloqueado.', status: 400 }
  }
  if (bloqueio.bloqueio_id || !eBloqueio(bloqueio)) {
    return { ok: false, erro: 'Isto não é um período bloqueado vindo de um calendário externo.', status: 400 }
  }
  if (bloqueio.estado === 'cancelada' || bloqueio.estado === 'no_show') {
    return {
      ok: false,
      erro: 'O período bloqueado de onde esta reserva veio foi cancelado na plataforma. Confirma lá se a reserva ainda existe.',
      status: 409,
    }
  }
  if (reserva.check_in < bloqueio.check_in || reserva.check_out > bloqueio.check_out) {
    return {
      ok: false,
      erro: `As datas têm de ficar dentro do período bloqueado (${bloqueio.check_in} a ${bloqueio.check_out}).`,
      status: 400,
    }
  }
  return { ok: true }
}

/** O bloqueio ainda contém a reserva? (as datas do Amenitiz podem mudar depois) */
export function aindaDentro(
  bloqueio: Pick<Booking, 'check_in' | 'check_out' | 'estado'> | null | undefined,
  reserva: Pick<Booking, 'check_in' | 'check_out'>,
): boolean {
  if (!bloqueio || bloqueio.estado === 'cancelada' || bloqueio.estado === 'no_show') return false
  return reserva.check_in >= bloqueio.check_in && reserva.check_out <= bloqueio.check_out
}

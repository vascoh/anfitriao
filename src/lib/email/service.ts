import 'server-only'
import { APP_URL } from '@/lib/config'
import { fmtDate } from '@/lib/utils'
import { platformFrom, propertyFrom } from './config'
import { emailIdentityForOwner } from './identity'
import { getEmailProvider } from './providers'
import type { EmailIdentity, SendResult } from './types'
import {
  reservationRequestEmail, reservationConfirmedEmail, ownerNewBookingEmail,
  type StayDetails,
} from './templates/reservations'
import { checkinCompleteEmail } from './templates/checkin'
import { paymentReminderEmail } from './templates/payment'
import { trialEndingEmail, trialExpiredEmail } from './templates/platform'

/**
 * EmailService — ponto único de envio de emails da aplicação.
 *
 * Dois tipos de email, nunca confundir:
 * - Alojamento (ao hóspede): From "«Alojamento» via Anfitriões <noreply@…>",
 *   Reply-To = email do alojamento. Nunca enviamos pelo domínio do cliente.
 * - Plataforma (ao anfitrião enquanto cliente do SaaS): From "Anfitriões <noreply@…>".
 *
 * Nota: registo de conta, verificação de email e recuperação de password são
 * enviados pelo Clerk; faturas pelo Stripe. Se um dia migrarem para aqui,
 * seguem o padrão dos emails de plataforma.
 */
class EmailService {
  /** Email de alojamento → hóspede (identidade + Reply-To do anfitrião). */
  private async sendAsProperty(identity: EmailIdentity, to: string, subject: string, html: string): Promise<SendResult> {
    return getEmailProvider().send({
      from: propertyFrom(identity.displayName),
      to,
      replyTo: identity.replyTo ?? undefined,
      subject,
      html,
    })
  }

  /** Email de plataforma → anfitrião. */
  private async sendAsPlatform(to: string, subject: string, html: string): Promise<SendResult> {
    return getEmailProvider().send({ from: platformFrom(), to, subject, html })
  }

  // ── Reservas ────────────────────────────────────────────────────────────────

  /** Hóspede: pedido de reserva recebido. */
  async sendReservationRequest(p: StayDetails & {
    ownerId: string | null
    guestName: string
    guestEmail: string
    notas: string | null
  }): Promise<SendResult> {
    const identity = await emailIdentityForOwner(p.ownerId)
    return this.sendAsProperty(
      identity,
      p.guestEmail,
      `Pedido de reserva recebido — ${p.propertyName}`,
      reservationRequestEmail({ ...p, identity }),
    )
  }

  /** Hóspede: reserva confirmada (com link de check-in online). */
  async sendReservationConfirmation(p: StayDetails & {
    ownerId: string | null
    bookingId: string
    guestName: string
    guestEmail: string
    instrucoes?: string | null
  }): Promise<SendResult> {
    const identity = await emailIdentityForOwner(p.ownerId)
    return this.sendAsProperty(
      identity,
      p.guestEmail,
      `Reserva confirmada — ${p.propertyName}`,
      reservationConfirmedEmail({ ...p, identity, checkinLink: `${APP_URL}/checkin/${p.bookingId}` }),
    )
  }

  /** Anfitrião: nova reserva pendente. (Email de plataforma — painel do SaaS.) */
  async sendOwnerNotification(p: StayDetails & {
    ownerId: string | null
    ownerEmail: string
    bookingId: string
    guestName: string
    guestEmail: string
    guestPhone: string | null
    notas: string | null
  }): Promise<SendResult> {
    const identity = await emailIdentityForOwner(p.ownerId)
    return this.sendAsPlatform(
      p.ownerEmail,
      `Nova reserva — ${p.propertyName} · ${fmtDate(p.checkIn)}`,
      ownerNewBookingEmail({ ...p, identity, baseUrl: APP_URL }),
    )
  }

  // ── Check-in ────────────────────────────────────────────────────────────────

  /** Anfitrião: hóspede concluiu o check-in online. */
  async sendCheckinComplete(p: {
    ownerId: string | null
    ownerEmail: string
    guestName: string
    propertyName: string
    checkIn: string
    numHospedes: number
    documento: string | null
    nacionalidade: string | null
    sibaComplete: boolean
  }): Promise<SendResult> {
    const identity = await emailIdentityForOwner(p.ownerId)
    return this.sendAsPlatform(
      p.ownerEmail,
      `✓ Check-in online concluído — ${p.guestName} · ${p.propertyName}`,
      checkinCompleteEmail({ ...p, identity }),
    )
  }

  // ── Pagamentos ──────────────────────────────────────────────────────────────

  /** Hóspede: lembrete de pagamento em falta. */
  async sendPaymentReminder(p: {
    ownerId: string | null
    guestName: string
    guestEmail: string
    propertyName: string
    checkIn: string
    checkOut: string
    numNights: number
    total: number
    pago: number
    saldo: number
  }): Promise<SendResult> {
    const identity = await emailIdentityForOwner(p.ownerId)
    return this.sendAsProperty(
      identity,
      p.guestEmail,
      `Pagamento pendente — ${p.propertyName} · ${fmtDate(p.checkIn)}`,
      paymentReminderEmail({ ...p, identity }),
    )
  }

  // ── Plataforma ──────────────────────────────────────────────────────────────

  /** Anfitrião: trial a expirar (3 dias / 1 dia). */
  async sendTrialEnding(p: { to: string; firstName: string; daysLeft: number; trialDate: string }): Promise<SendResult> {
    return this.sendAsPlatform(
      p.to,
      p.daysLeft === 1
        ? '⏰ O teu trial Anfitriões termina amanhã'
        : `⏳ ${p.daysLeft} dias até ao fim do teu trial Anfitriões`,
      trialEndingEmail({ ...p, baseUrl: APP_URL }),
    )
  }

  /** Anfitrião: trial expirou hoje. */
  async sendTrialExpired(p: { to: string; firstName: string }): Promise<SendResult> {
    return this.sendAsPlatform(
      p.to,
      '🔔 O teu trial Anfitriões expirou hoje',
      trialExpiredEmail({ ...p, baseUrl: APP_URL }),
    )
  }
}

export const emailService = new EmailService()

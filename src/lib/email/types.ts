// Tipos da camada de email.

/** Identidade visual/contactual dos emails de um alojamento (pertence ao anfitrião). */
export interface EmailIdentity {
  /** Nome mostrado ao hóspede (ex.: "Casa de Vasco") */
  displayName: string
  /** Nome do alojamento/marca (pode coincidir com displayName) */
  propertyName: string
  /** Para onde vão as respostas do hóspede (email de reservas ou principal) */
  replyTo: string | null
  /** Texto do logótipo (sem imagem por agora — logo_texto do website) */
  logoText: string
  primaryColor: string
  secondaryColor: string
  /** Assinatura livre no fim do email (opcional) */
  signature: string | null
  /** Contacto mostrado no corpo (telefone ou email) */
  contact: string
  supportEmail: string | null
  /** BCP-47 simplificado; por agora só 'pt' é usado nos templates */
  language: string
}

export interface EmailMessage {
  from: string
  to: string
  replyTo?: string
  subject: string
  html: string
}

export interface SendResult {
  ok: boolean
  /** id do provider, se disponível */
  id?: string
  error?: string
}

/** Interface de provider — trocar Resend por SES/SendGrid/Mailgun = nova implementação disto. */
export interface EmailProvider {
  readonly name: string
  send(msg: EmailMessage): Promise<SendResult>
}

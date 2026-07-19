// API pública da camada de email. Nenhum componente deve importar o SDK do
// Resend diretamente — todo o envio passa pelo emailService.
export { emailService } from './service'
export { emailIdentityForOwner, identityFromSettings } from './identity'
export type { EmailIdentity, EmailProvider, EmailMessage, SendResult } from './types'

// Configuração central — única fonte para URL base e remetente de email.
// Nunca repetir estes fallbacks inline: já causou emails/redirects a apontar
// para o URL antigo do Vercel em vez de anfitrioes.pt.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt'

// Em produção NOTIFY_FROM tem de estar definido (domínio verificado no Resend);
// o fallback resend.dev só serve para desenvolvimento.
export const NOTIFY_FROM = process.env.NOTIFY_FROM ?? 'Anfitrião <onboarding@resend.dev>'

// Configuração central — única fonte para URL base e remetente de email.
// Nunca repetir estes fallbacks inline: já causou emails/redirects a apontar
// para o URL antigo do Vercel em vez de anfitrioes.pt.

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://anfitrioes.pt'

// Configuração de email vive em lib/email/config.ts (EMAIL_FROM etc.).

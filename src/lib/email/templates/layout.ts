import { escHtml } from '@/lib/utils'
import { PLATFORM_NAME } from '../config'
import type { EmailIdentity } from '../types'

// Paleta neutra partilhada por todos os templates
const INK = '#1a1209'
const MUTED = '#6b5c4e'
const FAINT = '#9a8070'
const BG = '#f9f5f0'
const BORDER = '#ede8e0'

export interface EmailTheme {
  /** Nome no cabeçalho (alojamento ou plataforma) */
  brandName: string
  primaryColor: string
  secondaryColor: string
  signature: string | null
  /** Linha de contacto no rodapé do corpo (opcional) */
  contactLine: string | null
}

export function themeFromIdentity(identity: EmailIdentity): EmailTheme {
  return {
    brandName: identity.logoText,
    primaryColor: identity.primaryColor,
    secondaryColor: identity.secondaryColor,
    signature: identity.signature,
    contactLine: identity.contact || null,
  }
}

export function platformTheme(): EmailTheme {
  return {
    brandName: PLATFORM_NAME,
    primaryColor: '#C2714F',
    secondaryColor: FAINT,
    signature: null,
    contactLine: null,
  }
}

// ─── Blocos reutilizáveis ─────────────────────────────────────────────────────

export function kicker(text: string, theme: EmailTheme): string {
  return `<p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:${theme.secondaryColor};">${escHtml(text)}</p>`
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${INK};line-height:1.2;">${escHtml(text)}</h1>`
}

export function paragraph(html: string): string {
  return `<p style="margin:0 0 24px;font-size:14px;color:${MUTED};line-height:1.55;">${html}</p>`
}

/** Tabela de detalhes (par label → valor). `highlightLast` pinta o último valor com a cor primária. */
export function detailsTable(
  rows: Array<[string, string]>,
  theme: EmailTheme,
  opts?: { title?: string; highlightLast?: boolean },
): string {
  const body = rows.map(([label, value], i) => {
    const last = i === rows.length - 1
    const strong = opts?.highlightLast && last
    return `<tr>
      <td style="padding:5px 0;font-size:12px;color:${theme.secondaryColor};width:42%;">${escHtml(label)}</td>
      <td style="padding:5px 0;font-size:${strong ? 15 : 14}px;font-weight:${strong ? 700 : 600};color:${strong ? theme.primaryColor : INK};">${escHtml(value)}</td>
    </tr>`
  }).join('')
  return `<div style="background:${BG};border-radius:8px;padding:20px;margin-bottom:24px;">
    ${opts?.title ? `<p style="margin:0 0 12px;font-size:13px;font-weight:700;color:${INK};">${escHtml(opts.title)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;">${body}</table>
  </div>`
}

export function noteBox(title: string, text: string, theme: EmailTheme): string {
  return `<div style="margin-bottom:24px;background:#fffbf5;border:1px solid ${BORDER};border-radius:8px;padding:14px 16px;">
    <p style="margin:0 0 6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:${theme.secondaryColor};">${escHtml(title)}</p>
    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.55;">${escHtml(text)}</p>
  </div>`
}

export function ctaButton(label: string, href: string, theme: EmailTheme): string {
  return `<a href="${href}"
    style="display:block;text-align:center;background:${theme.primaryColor};color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;font-weight:700;margin-bottom:16px;">
    ${escHtml(label)}
  </a>`
}

export function finePrint(text: string, theme: EmailTheme): string {
  return `<p style="margin:0 0 24px;font-size:12px;color:${theme.secondaryColor};text-align:center;">${escHtml(text)}</p>`
}

/** Bloco de contacto do anfitrião no fim do corpo. */
export function hostFooter(hostName: string, contact: string, theme: EmailTheme): string {
  return `<div style="border-top:1px solid ${BORDER};padding-top:18px;">
    <p style="margin:0 0 4px;font-size:12px;color:${theme.secondaryColor};">Anfitrião: <strong style="color:${INK};">${escHtml(hostName)}</strong></p>
    ${contact ? `<p style="margin:0;font-size:12px;color:${theme.secondaryColor};">Contacto: <strong style="color:${INK};">${escHtml(contact)}</strong></p>` : ''}
  </div>`
}

// ─── Shell ────────────────────────────────────────────────────────────────────

/**
 * Envolve o conteúdo no layout comum: barra da cor da marca, cabeçalho com o
 * nome do alojamento, assinatura opcional e rodapé "Powered by Anfitriões".
 */
export function renderEmail(theme: EmailTheme, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:${BG};padding:32px 16px;margin:0;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BORDER};">
    <div style="height:4px;background:${theme.primaryColor};"></div>
    <div style="padding:18px 32px 0;">
      <p style="margin:0;font-size:15px;font-weight:700;color:${theme.primaryColor};">${escHtml(theme.brandName)}</p>
    </div>
    <div style="padding:20px 32px 24px;">
      ${bodyHtml}
      ${theme.signature ? `<p style="margin:24px 0 0;font-size:13px;color:${MUTED};line-height:1.6;white-space:pre-line;">${escHtml(theme.signature)}</p>` : ''}
    </div>
    <div style="padding:14px 32px;border-top:1px solid ${BORDER};background:${BG};">
      <p style="margin:0;font-size:11px;color:${FAINT};text-align:center;">Powered by ${PLATFORM_NAME}</p>
    </div>
  </div>
</body>
</html>`
}

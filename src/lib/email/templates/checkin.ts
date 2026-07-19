import { escHtml, fmtDate } from '@/lib/utils'
import type { EmailIdentity } from '../types'
import { renderEmail, themeFromIdentity, kicker, heading, paragraph, noteBox } from './layout'

/** Anfitrião: hóspede concluiu o check-in online. */
export function checkinCompleteEmail(p: {
  identity: EmailIdentity
  guestName: string
  propertyName: string
  checkIn: string
  numHospedes: number
  documento: string | null
  nacionalidade: string | null
  sibaComplete: boolean
}): string {
  const theme = themeFromIdentity(p.identity)
  const rows = [
    `<tr><td style="padding:3px 0;color:#6b5c4e;width:40%;">Propriedade</td><td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(p.propertyName)}</td></tr>`,
    `<tr><td style="padding:3px 0;color:#6b5c4e;">Check-in</td><td style="padding:3px 0;font-weight:600;color:#1a1209;">${fmtDate(p.checkIn)}</td></tr>`,
    `<tr><td style="padding:3px 0;color:#6b5c4e;">Hóspedes</td><td style="padding:3px 0;font-weight:600;color:#1a1209;">${p.numHospedes}</td></tr>`,
    p.documento ? `<tr><td style="padding:3px 0;color:#6b5c4e;">Documento</td><td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(p.documento)}</td></tr>` : '',
    p.nacionalidade ? `<tr><td style="padding:3px 0;color:#6b5c4e;">Nacionalidade</td><td style="padding:3px 0;font-weight:600;color:#1a1209;">${escHtml(p.nacionalidade)}</td></tr>` : '',
  ].join('')

  return renderEmail(theme, `
    ${kicker('Check-in online', theme)}
    ${heading('Hóspede registado com sucesso')}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534;">
        ${escHtml(p.guestName)}
        ${p.sibaComplete ? ' <span style="font-size:11px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;font-weight:600;margin-left:8px;">SIBA ✓</span>' : ''}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">${rows}</table>
    </div>
    ${p.sibaComplete ? '' : noteBox('Atenção', 'Alguns dados SIBA estão em falta. Verifica o perfil do hóspede antes da chegada.', theme)}
    ${paragraph('')}
  `)
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date & time utilities ────────────────────────────────────────────────────

export function uuid(): string {
  return crypto.randomUUID()
}

export function today(): string {
  // Data LOCAL do dispositivo — toISOString() daria a data UTC, que em
  // Europe/Lisbon (verão, UTC+1) mostra o dia anterior entre as 00:00 e a 01:00
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export function nights(check_in: string, check_out: string): number {
  const a = parseDate(check_in)
  const b = parseDate(check_out)
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('pt-PT', opts ?? { day: 'numeric', month: 'short' }).format(parseDate(iso))
}

/**
 * Euros, com os cêntimos só quando os há.
 *
 * Estava fixo em zero casas decimais, o que é bom num painel — «1250 €» lê-se
 * de relance — e é mentira em todo o sítio onde o número é o dinheiro em si.
 * O lembrete de pagamento dizia «20 € em falta» por um saldo de 19,60 €; o
 * mapa da taxa turística, que é declarado ao município, arredondava a linha e
 * o total; a ficha da reserva mostrava um total que não batia certo com a
 * fatura. Em nenhum desses casos havia como o anfitrião perceber que o número
 * no ecrã não era o número da conta.
 *
 * A regra decide-se pelo próprio valor: um total redondo continua a aparecer
 * redondo (não se ganha nada em escrever «1250,00 €» num cartão de resumo), e
 * um valor com cêntimos mostra-os. Assim os 112 sítios que chamam isto ficam
 * certos sem terem de escolher entre dois formatadores — escolher errado seria
 * exatamente o que acontecia.
 */
export function fmtMoney(n: number): string {
  // `Number.isInteger` não chega: 19.999 arredonda a 20,00 e mostrá-lo como
  // «20,00 €» está certo; o que não pode é virar «20 €» sem aviso.
  const temCentimos = Math.round(n * 100) % 100 !== 0
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: temCentimos ? 2 : 0,
    maximumFractionDigits: temCentimos ? 2 : 0,
  }).format(n)
}

export function addDays(iso: string, n: number): string {
  // UTC throughout: local midnight + toISOString() shifts a day back in TZ > UTC
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function escHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

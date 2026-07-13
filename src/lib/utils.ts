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

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
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

export const HEX_RE = /^#[0-9a-fA-F]{6}$/

/** Valida uma cor hex fornecida pelo utilizador; devolve o fallback se inválida. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return value && HEX_RE.test(value) ? value : fallback
}

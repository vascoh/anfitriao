// Geração do CSV de export SIBA (registo obrigatório de hóspedes).
// Lógica pura e testável — a rota /api/siba-export trata de auth e dados.

export interface SibaBookingRow {
  check_in: string
  check_out: string
  num_hospedes: number
  alojamento: string
  nome: string
  data_nascimento?: string | null
  nacionalidade?: string | null
  numero_documento?: string | null
  tipo_documento?: string | null
  data_validade_doc?: string | null
  sexo?: string | null
  pais_emissao?: string | null
}

/**
 * Escapa um valor para CSV: aspas duplicadas e célula entre aspas.
 * Neutraliza formula injection no Excel/Sheets — valores começados por
 * = + - @ ou tab/CR são prefixados com apóstrofo (dados de hóspedes são
 * input não confiável que o anfitrião vai abrir no Excel).
 */
export function escCsv(v: string | null | undefined): string {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Converte DD/MM/YYYY (vindo do OCR) para YYYY-MM-DD; passa através outros formatos. */
export function normalizeDate(s: string | null | undefined): string {
  if (!s) return ''
  if (s.includes('/')) {
    const [d, m, y] = s.split('/')
    return y && m && d ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : s
  }
  return s
}

export const SIBA_HEADER = [
  'Check-in', 'Check-out', 'Nº Hóspedes', 'Alojamento', 'Nome',
  'Data Nascimento', 'Nacionalidade', 'Nº Documento', 'Tipo Documento',
  'Validade Documento', 'Sexo', 'País Emissão',
]

/** Gera o CSV completo (com BOM UTF-8 e CRLF, para abrir bem no Excel PT). */
export function buildSibaCsv(rows: SibaBookingRow[]): string {
  const lines = rows.map(r =>
    [
      r.check_in,
      r.check_out,
      String(r.num_hospedes),
      r.alojamento,
      r.nome,
      normalizeDate(r.data_nascimento),
      r.nacionalidade ?? '',
      r.numero_documento ?? '',
      r.tipo_documento ?? '',
      normalizeDate(r.data_validade_doc),
      r.sexo ?? '',
      r.pais_emissao ?? '',
    ].map(escCsv).join(','),
  )
  return '﻿' + [SIBA_HEADER.map(escCsv).join(','), ...lines].join('\r\n')
}

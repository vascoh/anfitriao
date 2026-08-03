import type { Guest } from './types'
import { camposEmFalta } from './siba-xml'
import { boletimDaLinha, type LinhaBoletim } from './siba-mapping'

/**
 * Hóspedes de uma reserva — a lógica pura por trás de "um boletim por pessoa".
 *
 * O boletim de alojamento é individual (Lei 23/2007, art. 198.º). Uma reserva
 * de 8 pessoas precisa de 8 boletins, e a coima é por boletim em falta. Este
 * módulo é o que permite saber, a qualquer momento, quantos faltam e o que
 * falta a cada um.
 */

export interface HospedeDaReserva {
  guest: Guest
  /** Quem fez a reserva. É o contacto, não é um estatuto legal diferente. */
  principal: boolean
}

export interface EstadoBoletins {
  /** Pessoas que a reserva diz ter. */
  esperados: number
  /** Pessoas com ficha criada. */
  registados: number
  /** Fichas completas ao ponto de gerar boletim. */
  prontos: number
  /** Quantas fichas faltam criar. */
  porRegistar: number
  /** Fichas criadas mas incompletas, com o que falta a cada uma. */
  incompletos: Array<{ guest: Guest; faltam: string[] }>
  /** True quando todos os boletins da reserva podem ser entregues. */
  completo: boolean
}

/**
 * Converte um hóspede numa linha de boletim, para reaproveitar a validação
 * que já existe em `siba-mapping`. As datas da estadia vêm da reserva.
 */
function linhaDe(guest: Guest, checkIn: string, checkOut: string): LinhaBoletim {
  return {
    booking_id: '',
    check_in: checkIn,
    check_out: checkOut,
    nome: guest.nome ?? '',
    data_nascimento: guest.data_nascimento ?? null,
    nacionalidade: guest.nacionalidade ?? null,
    numero_documento: guest.numero_documento ?? null,
    tipo_documento: guest.tipo_documento ?? null,
    pais_emissao: guest.pais_emissao ?? null,
    pais_residencia: guest.pais_residencia ?? null,
    local_residencia: guest.local_residencia ?? null,
  }
}

/** O que falta a um hóspede para o boletim poder ser entregue. */
export function faltamAoHospede(guest: Guest, checkIn: string, checkOut: string): string[] {
  const convertido = boletimDaLinha(linhaDe(guest, checkIn, checkOut))
  return convertido.ok ? [] : convertido.faltam
}

/**
 * Estado dos boletins de uma reserva.
 *
 * Distingue três coisas que costumam ser confundidas numa só: pessoas que a
 * reserva diz ter, fichas criadas, e fichas completas. É a diferença entre
 * "faltam 5 pessoas por identificar" e "a Maria não tem número de documento".
 */
export function estadoDosBoletins(
  numHospedes: number,
  hospedes: HospedeDaReserva[],
  checkIn: string,
  checkOut: string,
): EstadoBoletins {
  const esperados = Math.max(numHospedes, hospedes.length)
  const incompletos: EstadoBoletins['incompletos'] = []
  let prontos = 0

  for (const { guest } of hospedes) {
    const faltam = faltamAoHospede(guest, checkIn, checkOut)
    if (faltam.length === 0) prontos++
    else incompletos.push({ guest, faltam })
  }

  const porRegistar = Math.max(0, esperados - hospedes.length)

  return {
    esperados,
    registados: hospedes.length,
    prontos,
    porRegistar,
    incompletos,
    completo: porRegistar === 0 && incompletos.length === 0 && esperados > 0,
  }
}

/**
 * Ordena a lista de hóspedes para apresentação: quem reservou primeiro, e
 * depois por nome. Sem isto a ordem vem da base de dados e muda entre
 * carregamentos, o que faz uma lista de 8 pessoas parecer instável.
 */
export function ordenarHospedes(hospedes: HospedeDaReserva[]): HospedeDaReserva[] {
  return [...hospedes].sort((a, b) => {
    if (a.principal !== b.principal) return a.principal ? -1 : 1
    return (a.guest.nome ?? '').localeCompare(b.guest.nome ?? '', 'pt')
  })
}

/**
 * True quando um hóspede tem o mínimo para valer a pena guardar.
 *
 * Um acompanhante sem nome é uma linha em branco que alguém deixou por
 * preencher — guardá-la só cria uma ficha vazia para limpar mais tarde.
 */
export function vaiSerGuardado(dados: { nome?: string | null }): boolean {
  return Boolean(dados.nome?.trim())
}

/** Campos que um acompanhante precisa, na ordem em que se pedem. */
export const CAMPOS_ACOMPANHANTE = [
  'nome', 'data_nascimento', 'nacionalidade', 'tipo_documento',
  'numero_documento', 'pais_emissao', 'pais_residencia',
] as const

export type CampoAcompanhante = typeof CAMPOS_ACOMPANHANTE[number]

/** Rótulos em português, partilhados entre o check-in e a app. */
export const ROTULO_CAMPO: Record<CampoAcompanhante, string> = {
  nome: 'Nome completo',
  data_nascimento: 'Data de nascimento',
  nacionalidade: 'Nacionalidade',
  tipo_documento: 'Tipo de documento',
  numero_documento: 'Nº do documento',
  pais_emissao: 'País de emissão',
  pais_residencia: 'País de residência',
}

/** Reexportado para quem só precisa de validar campos soltos. */
export { camposEmFalta }

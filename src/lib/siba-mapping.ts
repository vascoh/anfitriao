import {
  separarNome,
  separarCodigoPostal,
  normalizarTipoDocumento,
  codigoPais,
  camposEmFalta,
  type UnidadeHoteleira,
  type BoletimHospede,
} from './siba-xml'
import { normalizeDate } from './siba'

/**
 * Ponte entre o que a aplicação guarda e o que o SIBA exige.
 *
 * É aqui que quase tudo falha na prática. A app recolhe texto livre em
 * português ("Passaporte", "Alemanha", "Maria Silva Costa", "14/03/1985"); o
 * SIBA quer códigos de uma e três letras, nome partido em dois campos e datas
 * ISO. Manter esta tradução isolada e testada é o que permite dizer ao
 * anfitrião *que campo* corrigir em vez de lhe mostrar um código de retorno.
 */

/** Uma linha de reserva com os dados do hóspede, como vem da base. */
export interface LinhaBoletim {
  booking_id: string
  check_in: string
  check_out: string
  nome: string
  data_nascimento?: string | null
  nacionalidade?: string | null
  numero_documento?: string | null
  tipo_documento?: string | null
  pais_emissao?: string | null
  pais_residencia?: string | null
  local_residencia?: string | null
  local_nascimento?: string | null
}

/** Uma propriedade com os campos de registo no SIBA. */
export interface LinhaUnidade {
  id: string
  nome: string
  endereco?: string | null
  cidade?: string | null
  siba_nipc?: string | null
  siba_estabelecimento?: string | null
  siba_abreviatura?: string | null
  siba_codigo_postal?: string | null
  siba_telefone?: string | null
  siba_nome_contacto?: string | null
  siba_email_contacto?: string | null
}

export type ConversaoBoletim =
  | { ok: true; boletim: BoletimHospede }
  | { ok: false; faltam: string[] }

/**
 * Converte uma reserva num boletim, ou diz o que falta.
 *
 * Nunca inventa: uma nacionalidade que a tabela de países não conhece conta
 * como campo em falta, porque um código errado é recusado pelo SIBA na mesma
 * e sem dizer porquê.
 */
export function boletimDaLinha(linha: LinhaBoletim): ConversaoBoletim {
  const { nome, apelido } = separarNome(linha.nome ?? '')

  const parcial: Partial<BoletimHospede> = {
    apelido,
    nome,
    nacionalidade: codigoPais(linha.nacionalidade),
    dataNascimento: normalizeDate(linha.data_nascimento) || undefined,
    localNascimento: linha.local_nascimento?.trim() || undefined,
    documentoIdentificacao: linha.numero_documento?.trim() || undefined,
    paisEmissorDocumento: codigoPais(linha.pais_emissao) ?? codigoPais(linha.nacionalidade),
    tipoDocumento: normalizarTipoDocumento(linha.tipo_documento),
    dataEntrada: linha.check_in,
    dataSaida: linha.check_out || undefined,
    paisResidenciaOrigem: codigoPais(linha.pais_residencia),
    localResidenciaOrigem: linha.local_residencia?.trim() || undefined,
  }

  const faltam = camposEmFalta(parcial)
  if (faltam.length > 0) return { ok: false, faltam }

  return { ok: true, boletim: parcial as BoletimHospede }
}

export type ConversaoUnidade =
  | { ok: true; unidade: UnidadeHoteleira }
  | { ok: false; faltam: string[] }

/**
 * Converte uma propriedade na unidade hoteleira do boletim.
 *
 * A abreviatura e os contactos caem para valores derivados do que já existe
 * quando não foram preenchidos — são campos de forma, não de substância, e
 * obrigar a preenchê-los travava o anfitrião sem o proteger de nada.
 */
export function unidadeDaPropriedade(
  p: LinhaUnidade,
  contactoOmissao?: { nome?: string | null; email?: string | null },
): ConversaoUnidade {
  const faltam: string[] = []
  if (!p.siba_nipc?.trim()) faltam.push('NIPC')
  if (!p.siba_estabelecimento?.trim()) faltam.push('número de estabelecimento')

  const { codigoPostal, zonaPostal } = separarCodigoPostal(p.siba_codigo_postal)
  if (!codigoPostal) faltam.push('código postal')

  const emailContacto = p.siba_email_contacto?.trim() || contactoOmissao?.email?.trim() || ''
  if (!emailContacto) faltam.push('email de contacto')

  if (faltam.length > 0) return { ok: false, faltam }

  return {
    ok: true,
    unidade: {
      nipc: p.siba_nipc!.trim(),
      estabelecimento: p.siba_estabelecimento!.trim(),
      nome: p.nome,
      abreviatura: p.siba_abreviatura?.trim() || abreviaturaDe(p.nome),
      morada: p.endereco?.trim() || '',
      localidade: p.cidade?.trim() || '',
      codigoPostal,
      zonaPostal,
      telefone: p.siba_telefone?.trim() || '',
      nomeContacto: p.siba_nome_contacto?.trim() || contactoOmissao?.nome?.trim() || p.nome,
      emailContacto,
    },
  }
}

/** "Casa do Vale" → "CDV". Iniciais das palavras com significado, até 3. */
export function abreviaturaDe(nome: string): string {
  const ignorar = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os'])
  const iniciais = nome
    .trim()
    .split(/\s+/)
    .filter(p => p && !ignorar.has(p.toLowerCase()))
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
  return (iniciais || nome.slice(0, 3)).slice(0, 3).toUpperCase()
}

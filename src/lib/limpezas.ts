/**
 * Limpezas entre hóspedes — regras puras.
 *
 * Uma limpeza não se cria à mão: **é a saída de uma estadia**. Cada check-out
 * de um quarto é um quarto por arrumar, e o que interessa a quem limpa é o que
 * vem a seguir — se entra alguém no mesmo dia (a janela é de horas, não de
 * dias) e quantas camas há para fazer.
 *
 * Por isso o plano é derivado das reservas a cada leitura, e a base só guarda
 * o que uma pessoa disse sobre ele (`feita`, `problema`, uma nota). Uma reserva
 * que muda de datas leva a limpeza consigo sem nada para sincronizar; a linha
 * antiga fica órfã e simplesmente deixa de aparecer.
 *
 * O que não entra:
 * - reservas canceladas e no-shows (ninguém dormiu lá);
 * - fechos feitos à mão no Anfitrião (obras, uso próprio — o anfitrião sabe o
 *   que lá se passa e não precisa que lhe lembrem);
 * - uma saída numa noite que outra **reserva** continua a ocupar: é um
 *   artefacto dos dados (duas reservas sobrepostas), não um quarto vazio.
 *
 * Os fechos vindos de um feed entram, marcados como `incerta`: o Amenitiz
 * manda as reservas como «Quarto indisponível», sem as distinguir de um fecho
 * (ver `eBloqueio`), e uma limpeza a mais custa uma pergunta; uma a menos é um
 * hóspede a entrar num quarto por fazer.
 */

import { eBloqueio } from './reservations'
import type { Booking } from './types'

export type EstadoLimpeza = 'por_fazer' | 'feita' | 'problema'
export const ESTADOS_LIMPEZA: EstadoLimpeza[] = ['por_fazer', 'feita', 'problema']
export const LIMITE_NOTA = 500

/** O que uma pessoa disse sobre uma limpeza. Guardado em `limpezas`. */
export interface RegistoLimpeza {
  propriedade_id: string
  data: string
  estado: EstadoLimpeza
  nota: string | null
  por: string | null
  atualizado_em: string
}

export interface Limpeza {
  /** `propriedade_id:data` — identifica a limpeza sem tabela própria. */
  chave: string
  propriedade_id: string
  /** Dia da limpeza: o check-out de quem sai. */
  data: string
  saida: { hospedes: number }
  /** Próxima estadia no mesmo quarto, se houver uma conhecida. */
  entrada: { data: string; hospedes: number; noites: number } | null
  /** Entra alguém no próprio dia da saída. */
  mesmoDia: boolean
  /** A saída é um fecho vindo de um feed: pode não ter havido hóspede. */
  incerta: boolean
  estado: EstadoLimpeza
  nota: string | null
  por: string | null
  atualizado_em: string | null
}

type Estadia = Pick<Booking,
  'id' | 'propriedade_id' | 'check_in' | 'check_out' | 'estado' | 'num_hospedes' |
  'hospede_id' | 'uid_externo' | 'notas' | 'origem'>

type Tipo = 'reserva' | 'fecho_feed' | 'fecho_manual'

function tipoDe(b: Estadia): Tipo {
  if (!eBloqueio(b)) return 'reserva'
  return b.uid_externo ? 'fecho_feed' : 'fecho_manual'
}

function noitesEntre(de: string, ate: string): number {
  const ms = Date.UTC(+ate.slice(0, 4), +ate.slice(5, 7) - 1, +ate.slice(8, 10)) -
    Date.UTC(+de.slice(0, 4), +de.slice(5, 7) - 1, +de.slice(8, 10))
  return Math.max(0, Math.round(ms / 86_400_000))
}

export function chaveLimpeza(propriedadeId: string, data: string): string {
  return `${propriedadeId}:${data}`
}

/**
 * As limpezas com dia entre `de` e `ate` (inclusive), por data e depois pela
 * ordem de `ordemUnidades` (a ordem em que o anfitrião vê os quartos).
 *
 * `reservas` deve incluir as estadias que começam depois de `ate`, para que a
 * última limpeza da janela saiba quem entra a seguir.
 */
export function planearLimpezas(p: {
  reservas: Estadia[]
  de: string
  ate: string
  registos?: RegistoLimpeza[]
  /** Se indicado, só estes quartos (e nesta ordem). */
  ordemUnidades?: string[]
}): Limpeza[] {
  const permitidas = p.ordemUnidades ? new Set(p.ordemUnidades) : null
  const registos = new Map((p.registos ?? []).map(r => [chaveLimpeza(r.propriedade_id, r.data), r]))

  const porUnidade = new Map<string, Array<Estadia & { tipo: Tipo }>>()
  for (const b of p.reservas) {
    if (b.estado === 'cancelada' || b.estado === 'no_show') continue
    if (permitidas && !permitidas.has(b.propriedade_id)) continue
    if (!b.check_in || !b.check_out || b.check_out <= b.check_in) continue
    const lista = porUnidade.get(b.propriedade_id) ?? []
    lista.push({ ...b, tipo: tipoDe(b) })
    porUnidade.set(b.propriedade_id, lista)
  }

  const limpezas: Limpeza[] = []

  for (const [unidade, estadias] of porUnidade) {
    estadias.sort((a, b) => a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out))
    const porData = new Map<string, Limpeza>()

    for (const s of estadias) {
      if (s.tipo === 'fecho_manual') continue
      const data = s.check_out
      if (data < p.de || data > p.ate) continue

      // Outra reserva continua a ocupar o quarto nessa noite: não há troca.
      const ocupado = estadias.some(o =>
        o !== s && o.tipo === 'reserva' && o.check_in < data && o.check_out > data)
      if (ocupado) continue

      const seguinte = estadias.find(o =>
        o !== s && o.tipo !== 'fecho_manual' && o.check_in >= data)

      const incerta = s.tipo === 'fecho_feed'
      const existente = porData.get(data)
      // Duas saídas no mesmo dia (uma reserva e um fecho do mesmo feed, por
      // exemplo): uma limpeza só, e a reserva diz mais do que o fecho.
      if (existente) {
        if (existente.incerta && !incerta) {
          existente.incerta = false
          existente.saida = { hospedes: s.num_hospedes || 1 }
        }
        continue
      }

      const reg = registos.get(chaveLimpeza(unidade, data))
      porData.set(data, {
        chave: chaveLimpeza(unidade, data),
        propriedade_id: unidade,
        data,
        saida: { hospedes: incerta ? 0 : s.num_hospedes || 1 },
        entrada: seguinte
          ? {
            data: seguinte.check_in,
            hospedes: seguinte.tipo === 'reserva' ? seguinte.num_hospedes || 1 : 0,
            noites: noitesEntre(seguinte.check_in, seguinte.check_out),
          }
          : null,
        mesmoDia: !!seguinte && seguinte.check_in === data,
        incerta,
        estado: reg?.estado ?? 'por_fazer',
        nota: reg?.nota ?? null,
        por: reg?.por ?? null,
        atualizado_em: reg?.atualizado_em ?? null,
      })
    }

    limpezas.push(...porData.values())
  }

  const ordem = new Map((p.ordemUnidades ?? []).map((id, i) => [id, i]))
  return limpezas.sort((a, b) =>
    a.data.localeCompare(b.data) ||
    Number(b.mesmoDia) - Number(a.mesmoDia) ||
    (ordem.get(a.propriedade_id) ?? 1e9) - (ordem.get(b.propriedade_id) ?? 1e9) ||
    a.propriedade_id.localeCompare(b.propriedade_id))
}

/**
 * Por fazer e com o dia já passado. Não é um alarme sobre o quarto (quase
 * sempre a limpeza foi feita e ninguém a marcou), é um pedido de confirmação.
 */
export function porConfirmar(l: Pick<Limpeza, 'estado' | 'data'>, hoje: string): boolean {
  return l.estado === 'por_fazer' && l.data < hoje
}

/** Validação do que chega de fora (anfitrião ou equipa). */
export function validarMarcacao(body: unknown, hoje: string): {
  propriedade_id: string; data: string; estado: EstadoLimpeza; nota: string | null
} | { erro: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const propriedade_id = typeof b.propriedade_id === 'string' ? b.propriedade_id.trim() : ''
  const data = typeof b.data === 'string' ? b.data : ''
  const estado = b.estado as EstadoLimpeza
  if (!propriedade_id || propriedade_id.length > 100) return { erro: 'Alojamento em falta.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { erro: 'Data inválida.' }
  if (!ESTADOS_LIMPEZA.includes(estado)) return { erro: 'Estado inválido.' }
  // Marcar uma limpeza de daqui a um mês como feita é um toque no sítio errado.
  if (estado !== 'por_fazer' && data > addDiasIso(hoje, 1)) {
    return { erro: 'Só se marca uma limpeza no próprio dia ou depois.' }
  }
  const notaBruta = typeof b.nota === 'string' ? b.nota.trim() : ''
  if (notaBruta.length > LIMITE_NOTA) return { erro: `A nota tem no máximo ${LIMITE_NOTA} caracteres.` }
  if (estado === 'problema' && !notaBruta) return { erro: 'Descreve o problema numa frase.' }
  return { propriedade_id, data, estado, nota: notaBruta || null }
}

function addDiasIso(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n))
  return d.toISOString().slice(0, 10)
}

/** Validação do nome e dos alojamentos de um link de equipa. */
export function validarAcesso(body: unknown, alojamentosDoDono: Set<string>): {
  nome: string; propriedade_ids: string[]
} | { erro: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const nome = typeof b.nome === 'string' ? b.nome.trim() : ''
  if (!nome) return { erro: 'Dá um nome a quem vai usar o link (ex.: «Maria — limpezas»).' }
  if (nome.length > 60) return { erro: 'O nome tem no máximo 60 caracteres.' }
  const ids = Array.isArray(b.propriedade_ids) ? b.propriedade_ids : []
  if (ids.length > 200 || ids.some(id => typeof id !== 'string')) return { erro: 'Lista de alojamentos inválida.' }
  const unicos = [...new Set(ids as string[])]
  if (unicos.some(id => !alojamentosDoDono.has(id))) return { erro: 'Alojamento desconhecido.' }
  return { nome, propriedade_ids: unicos }
}

/**
 * Os quartos que um link vê. Uma lista vazia é «todos»; escolher uma casa
 * inclui os quartos dela — quem limpa a casa limpa os quartos.
 */
export function unidadesDoAcesso(
  escolhidas: string[],
  propriedades: Array<{ id: string; parent_id?: string | null }>,
): Set<string> {
  if (!escolhidas.length) return new Set(propriedades.map(p => p.id))
  const set = new Set(escolhidas)
  for (const p of propriedades) {
    if (p.parent_id && set.has(p.parent_id)) set.add(p.id)
  }
  return set
}

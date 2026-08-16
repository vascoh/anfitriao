import type { Property, WebsiteSettings } from './types'

/**
 * O que falta para o site do anfitrião valer a pena ser visto.
 *
 * A app deixava publicar um site sem nada: sem nome próprio, sem foto e sem
 * contacto. O resultado está à vista na primeira conta real — chama-se
 * **"Reservas Diretas"**, que é o valor por omissão da coluna, e ninguém
 * reparou durante meses porque nada o assinalava.
 *
 * Não é um assistente de vários passos: é uma lista curta que diz o que falta
 * e leva lá. Três coisas bloqueiam a publicação, o resto é conselho.
 *
 * ## Porque é que estas três
 *
 * - **Endereço**: sem ele não há sequer URL para partilhar.
 * - **Nome próprio**: o site é dele, não nosso. Publicar com o valor de
 *   fábrica é pior do que não publicar — parece abandonado.
 * - **Contacto**: um hóspede com dúvidas que não tem para onde ligar vai
 *   reservar no Airbnb, que é precisamente o que este site existe para evitar.
 * - **Uma foto**: ninguém reserva alojamento às cegas. Conta como essencial
 *   por ser a diferença entre uma página e um anúncio.
 *
 * O que **não** bloqueia: descrição, frase do anfitrião, FAQ, blog, cores.
 * Melhoram o site; a falta deles não o torna inútil.
 */

/** Valor por omissão da coluna `nome` — não é um nome, é a ausência de um. */
export const NOME_POR_OMISSAO = 'Reservas Diretas'

export interface ItemProntidao {
  chave: 'endereco' | 'nome' | 'contacto' | 'foto' | 'descricao' | 'apresentacao'
  titulo: string
  /** O que fazer, em concreto. */
  ajuda: string
  feito: boolean
  /** Impede a publicação enquanto estiver por fazer. */
  essencial: boolean
}

export function itensDeProntidao(
  settings: Pick<WebsiteSettings, 'nome' | 'slug' | 'email' | 'telefone' | 'descricao' | 'host_nome' | 'host_bio'> | null,
  properties: Property[],
): ItemProntidao[] {
  const s = settings
  const ativas = properties.filter(p => p.ativo)
  const comFoto = ativas.filter(p => Boolean(p.imagem_url) || (p.fotos?.length ?? 0) > 0)

  const nome = s?.nome?.trim() ?? ''
  const temNomeProprio = nome.length > 0 && nome !== NOME_POR_OMISSAO

  return [
    {
      chave: 'endereco',
      titulo: 'Endereço do site',
      ajuda: 'Escolhe o endereço onde os hóspedes vão encontrar-te.',
      feito: Boolean(s?.slug),
      essencial: true,
    },
    {
      chave: 'nome',
      titulo: 'Nome do alojamento',
      ajuda: temNomeProprio
        ? 'O nome que aparece no site e nos emails.'
        : `Está com o nome de fábrica («${NOME_POR_OMISSAO}»). Põe o teu.`,
      feito: temNomeProprio,
      essencial: true,
    },
    {
      chave: 'contacto',
      titulo: 'Contacto',
      ajuda: 'Email ou telefone — para o hóspede poder perguntar antes de reservar.',
      feito: Boolean(s?.email?.trim() || s?.telefone?.trim()),
      essencial: true,
    },
    {
      chave: 'foto',
      titulo: 'Uma foto, pelo menos',
      ajuda: ativas.length === 0
        ? 'Cria primeiro um alojamento ativo.'
        : 'Nenhum dos teus alojamentos tem foto. Ninguém reserva às cegas.',
      feito: comFoto.length > 0,
      essencial: true,
    },
    {
      chave: 'descricao',
      titulo: 'Descrição',
      ajuda: 'Uma frase sobre o que o hóspede vai encontrar.',
      feito: Boolean(s?.descricao?.trim()),
      essencial: false,
    },
    {
      chave: 'apresentacao',
      titulo: 'Quem recebe',
      ajuda: 'O teu nome e uma frase de apresentação — é o que faz uma reserva direta parecer segura.',
      feito: Boolean(s?.host_nome?.trim() && s?.host_bio?.trim()),
      essencial: false,
    },
  ]
}

export interface EstadoProntidao {
  itens: ItemProntidao[]
  /** Essenciais por fazer — vazio significa que pode publicar. */
  emFalta: ItemProntidao[]
  podePublicar: boolean
  /** Quantos itens (essenciais e opcionais) já estão feitos. */
  feitos: number
  total: number
}

export function prontidaoDoSite(
  settings: Parameters<typeof itensDeProntidao>[0],
  properties: Property[],
): EstadoProntidao {
  const itens = itensDeProntidao(settings, properties)
  const emFalta = itens.filter(i => i.essencial && !i.feito)

  return {
    itens,
    emFalta,
    podePublicar: emFalta.length === 0,
    feitos: itens.filter(i => i.feito).length,
    total: itens.length,
  }
}

/** Frase única para explicar o que falta, sem listar tudo. */
export function motivoParaNaoPublicar(emFalta: ItemProntidao[]): string {
  if (emFalta.length === 0) return ''
  const nomes = emFalta.map(i => i.titulo.toLowerCase())
  const lista = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
  return `Antes de publicar, falta: ${lista}.`
}

/**
 * Caixa de entrada — regras puras (sem base de dados nem rede).
 *
 * Uma conversa é uma reserva. Uma mensagem sem reserva (um WhatsApp de um
 * número que não reconhecemos, um email de alguém sem reserva) faz conversa
 * com o próprio contacto, até o anfitrião a associar.
 */

export type CanalMensagem = 'email' | 'whatsapp' | 'sms' | 'airbnb' | 'booking' | 'outro'
export type DirecaoMensagem = 'entrada' | 'saida'
export type EstadoMensagem = 'recebida' | 'registada' | 'enviada' | 'falhou'

export interface Mensagem {
  id: string
  owner_id: string
  reserva_id: string | null
  hospede_id: string | null
  canal: CanalMensagem
  direcao: DirecaoMensagem
  estado: EstadoMensagem
  assunto: string | null
  corpo: string
  contacto: string | null
  nome_contacto: string | null
  id_externo: string | null
  sugerida_por_ia: boolean
  lida_em: string | null
  erro: string | null
  criado_em: string
}

export const CANAIS: CanalMensagem[] = ['email', 'whatsapp', 'sms', 'airbnb', 'booking', 'outro']

export const CANAL_LABEL: Record<CanalMensagem, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  outro: 'Outro',
}

/** Canais por onde a aplicação envia. Os outros só se registam. */
export const CANAIS_DE_ENVIO: CanalMensagem[] = ['email', 'whatsapp']

export const LIMITE_CORPO = 20000
export const LIMITE_ASSUNTO = 300

export function eCanal(v: unknown): v is CanalMensagem {
  return typeof v === 'string' && (CANAIS as string[]).includes(v)
}

/**
 * Telefone em formato E.164 sem o «+» (como a Meta o envia: `351912345678`).
 *
 * Os telefones dos hóspedes chegam escritos de mil maneiras — «912 345 678»,
 * «+351 912345678», «00351912345678». Um número português de 9 dígitos sem
 * indicativo ganha o 351; não há forma de adivinhar o país de outro número
 * sem indicativo, e então fica como está.
 */
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null
  let d = bruto.replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  d = d.replace(/\D/g, '')
  if (/^[29]\d{8}$/.test(d)) d = `351${d}`
  return d.length >= 8 && d.length <= 15 ? d : null
}

/** Link «clique para conversar» do WhatsApp, com o texto já escrito. */
export function linkWhatsApp(telefone: string, texto: string): string | null {
  const numero = normalizarTelefone(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/**
 * A Meta só deixa enviar texto livre até 24 h depois da última mensagem do
 * hóspede; fora dessa janela só modelos aprovados. Fora dela, o envio pela
 * API falha — mais vale saber antes e abrir o WhatsApp do telemóvel.
 */
export const JANELA_WHATSAPP_MS = 24 * 60 * 60 * 1000

export function dentroDaJanelaWhatsApp(mensagens: Pick<Mensagem, 'canal' | 'direcao' | 'criado_em'>[], agora = Date.now()): boolean {
  const ultima = mensagens
    .filter(m => m.canal === 'whatsapp' && m.direcao === 'entrada')
    .reduce<number>((max, m) => Math.max(max, Date.parse(m.criado_em) || 0), 0)
  return ultima > 0 && agora - ultima < JANELA_WHATSAPP_MS
}

export function chaveConversa(m: Pick<Mensagem, 'reserva_id' | 'contacto' | 'canal'>): string {
  if (m.reserva_id) return `reserva:${m.reserva_id}`
  return `contacto:${m.canal}:${(m.contacto ?? '').toLowerCase()}`
}

export interface Conversa {
  chave: string
  reserva_id: string | null
  hospede_id: string | null
  contacto: string | null
  nome_contacto: string | null
  canal: CanalMensagem
  ultima: Mensagem
  porLer: number
  /** A última mensagem é do hóspede: falta responder. */
  porResponder: boolean
  total: number
}

/**
 * Agrupa mensagens (qualquer ordem) em conversas, mais recentes primeiro.
 * Uma conversa com mensagens por ler sobe ao topo; dentro de cada grupo,
 * ordena-se pela última mensagem.
 */
export function agruparConversas(mensagens: Mensagem[]): Conversa[] {
  const porChave = new Map<string, Mensagem[]>()
  for (const m of mensagens) {
    const k = chaveConversa(m)
    const lista = porChave.get(k)
    if (lista) lista.push(m)
    else porChave.set(k, [m])
  }

  const conversas: Conversa[] = []
  for (const [chave, lista] of porChave) {
    lista.sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    const ultima = lista[lista.length - 1]
    const comContacto = [...lista].reverse().find(m => m.direcao === 'entrada' && m.contacto) ?? lista.find(m => m.contacto)
    conversas.push({
      chave,
      reserva_id: ultima.reserva_id,
      hospede_id: lista.find(m => m.hospede_id)?.hospede_id ?? null,
      contacto: comContacto?.contacto ?? null,
      nome_contacto: lista.find(m => m.nome_contacto)?.nome_contacto ?? null,
      canal: ultima.canal,
      ultima,
      porLer: lista.filter(m => m.direcao === 'entrada' && !m.lida_em).length,
      porResponder: ultima.direcao === 'entrada',
      total: lista.length,
    })
  }

  return conversas.sort((a, b) => {
    if ((a.porLer > 0) !== (b.porLer > 0)) return a.porLer > 0 ? -1 : 1
    return b.ultima.criado_em.localeCompare(a.ultima.criado_em)
  })
}

/**
 * Texto útil de um email de resposta: corta a citação do email anterior
 * («On … wrote:», «Em … escreveu:», linhas com «>») e a assinatura «-- ».
 * Sem isto, cada resposta trazia a conversa inteira atrás e a IA lia-a
 * duas vezes.
 */
export function limparRespostaEmail(texto: string): string {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  const fim = linhas.findIndex(l =>
    /^\s*>/.test(l) ||
    /^-- ?$/.test(l) ||
    /^\s*(On|Em|Le|El|Am|Il)\b.{0,200}(wrote|escreveu|a écrit|escribió|schrieb|ha scritto)\s*:?\s*$/i.test(l) ||
    /^\s*-{2,}\s*(Original Message|Mensagem original|Message d'origine)/i.test(l) ||
    (/^\s*From:\s/i.test(l) && linhas.some(x => /^\s*Sent:\s/i.test(x))),
  )
  const util = (fim === -1 ? linhas : linhas.slice(0, fim)).join('\n').trim()
  return util || texto.trim()
}

/** HTML de email → texto simples, para quando o fornecedor não dá a versão texto. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Endereço de um campo From/To: «Maria <maria@x.pt>» → «maria@x.pt». */
export function enderecoEmail(campo: string | null | undefined): string | null {
  if (!campo) return null
  const m = campo.match(/<([^>]+)>/)
  const e = (m ? m[1] : campo).trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null
}

/** Nome de um campo From: «Maria Silva <maria@x.pt>» → «Maria Silva». */
export function nomeDoRemetente(campo: string | null | undefined): string | null {
  if (!campo) return null
  const m = campo.match(/^\s*"?([^"<]+?)"?\s*</)
  return m ? m[1].trim().slice(0, 200) : null
}

/**
 * Forma canónica de um contacto, para a mesma pessoa não abrir duas
 * conversas: email em minúsculas, telefone em E.164 sem «+».
 */
export function normalizarContacto(canal: CanalMensagem, bruto: string | null | undefined): string | null {
  if (!bruto?.trim()) return null
  if (canal === 'email') return enderecoEmail(bruto)
  if (canal === 'whatsapp' || canal === 'sms') return normalizarTelefone(bruto)
  return bruto.trim().toLowerCase().slice(0, 320)
}

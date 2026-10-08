import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decifrar, encriptar, estaConfigurada } from '@/lib/crypto'
import { LIMITE_ASSUNTO, LIMITE_CORPO, enderecoEmail, normalizarTelefone, type Mensagem, type OrigemMensagem } from '@/lib/mensagens'

/**
 * Caixa de entrada — o que só o servidor pode fazer: assinar endereços de
 * resposta, falar com a Cloud API do WhatsApp e encontrar a reserva a que uma
 * mensagem que chega pertence.
 */

// ─── Endereço de resposta por conversa ─────────────────────────────────────
//
// O email ao hóspede sai com Reply-To `r+<reserva>.<assinatura>@<domínio>`.
// A resposta dele chega ao Resend (MX do subdomínio de receção), que a envia
// ao webhook `/api/mensagens/entrada/email`; a assinatura impede que alguém
// que saiba (ou adivinhe) um id de reserva escreva na caixa de outro
// anfitrião.

// Os ids de reserva são uuids em minúsculas; os endereços de email chegam
// em minúsculas, e a assinatura tem de sobreviver a isso.
const ID_SEGURO = /^[a-z0-9-]{1,64}$/

function chaveDeAssinatura(): Buffer | null {
  const base = process.env.APP_ENCRYPTION_KEY
  if (!base) return null
  // Derivada, para a chave de cifra nunca ser usada diretamente noutro papel.
  return createHmac('sha256', base).update('anfitriao:reply-to:v1').digest()
}

function assinar(reservaId: string, chave: Buffer): string {
  return createHmac('sha256', chave).update(reservaId).digest('base64url').slice(0, 16).toLowerCase()
}

export function dominioDeRececao(): string | null {
  const d = process.env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase()
  return d && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null
}

/** A receção de respostas por email está montada (domínio, chave e segredo do webhook). */
export function rececaoEmailAtiva(): boolean {
  return Boolean(dominioDeRececao() && chaveDeAssinatura() && process.env.RESEND_WEBHOOK_SECRET)
}

export function enderecoDeResposta(reservaId: string): string | null {
  const dominio = dominioDeRececao()
  const chave = chaveDeAssinatura()
  if (!dominio || !chave || !ID_SEGURO.test(reservaId) || !rececaoEmailAtiva()) return null
  return `r+${reservaId}.${assinar(reservaId, chave)}@${dominio}`
}

/** Reserva de um endereço de resposta, se a assinatura for válida. */
export function reservaDoEndereco(endereco: string): string | null {
  const chave = chaveDeAssinatura()
  const dominio = dominioDeRececao()
  if (!chave || !dominio) return null
  const m = endereco.trim().toLowerCase().match(/^r\+([a-z0-9-]{1,64})\.([a-z0-9_-]{16})@(.+)$/)
  if (!m || m[3] !== dominio) return null
  const id = m[1]
  const esperada = Buffer.from(assinar(id, chave))
  const recebida = Buffer.from(m[2])
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida) ? id : null
}

// ─── WhatsApp Cloud API ────────────────────────────────────────────────────

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION ?? 'v23.0'}`

export interface LigacaoWhatsApp {
  owner_id: string
  phone_number_id: string
  numero_exibido: string | null
  token: string
  app_secret: string
  verify_token: string
}

interface LinhaLigacao {
  owner_id: string
  phone_number_id: string
  numero_exibido: string | null
  token_cifrado: string
  app_secret_cifrado: string
  verify_token: string
}

function abrir(l: LinhaLigacao): LigacaoWhatsApp | null {
  try {
    return {
      owner_id: l.owner_id,
      phone_number_id: l.phone_number_id,
      numero_exibido: l.numero_exibido,
      token: decifrar(l.token_cifrado),
      app_secret: decifrar(l.app_secret_cifrado),
      verify_token: l.verify_token,
    }
  } catch (err) {
    console.error('[whatsapp] não foi possível decifrar a ligação', l.owner_id, err)
    return null
  }
}

export async function ligacaoWhatsAppDoDono(supabase: SupabaseClient, ownerId: string): Promise<LigacaoWhatsApp | null> {
  const { data } = await supabase.from('whatsapp_ligacoes').select('*').eq('owner_id', ownerId).maybeSingle()
  return data ? abrir(data as LinhaLigacao) : null
}

export async function ligacaoWhatsAppDoNumero(supabase: SupabaseClient, phoneNumberId: string): Promise<LigacaoWhatsApp | null> {
  const { data } = await supabase.from('whatsapp_ligacoes').select('*').eq('phone_number_id', phoneNumberId).maybeSingle()
  return data ? abrir(data as LinhaLigacao) : null
}

export function cifrarSegredosWhatsApp(token: string, appSecret: string): { token_cifrado: string; app_secret_cifrado: string } | null {
  if (!estaConfigurada()) return null
  return { token_cifrado: encriptar(token), app_secret_cifrado: encriptar(appSecret) }
}

/** `X-Hub-Signature-256: sha256=<hex>` — HMAC do corpo cru com o segredo da app. */
export function assinaturaMetaValida(corpo: string, cabecalho: string | null, appSecret: string): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false
  const esperada = Buffer.from(createHmac('sha256', appSecret).update(corpo).digest('hex'))
  const recebida = Buffer.from(cabecalho.slice('sha256='.length))
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

export async function enviarWhatsAppApi(
  ligacao: LigacaoWhatsApp,
  para: string,
  texto: string,
): Promise<{ ok: true; id: string | null } | { ok: false; erro: string }> {
  const numero = normalizarTelefone(para)
  if (!numero) return { ok: false, erro: 'Número de telefone inválido.' }
  try {
    const res = await fetch(`${GRAPH}/${encodeURIComponent(ligacao.phone_number_id)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ligacao.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: numero,
        type: 'text',
        text: { preview_url: false, body: texto },
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const dados = await res.json().catch(() => null) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null
    if (!res.ok) {
      const codigo = dados?.error?.code
      // 131047: fora da janela de 24 h — só modelos aprovados.
      const erro = codigo === 131047
        ? 'Passaram mais de 24 h desde a última mensagem do hóspede: o WhatsApp só deixa enviar modelos aprovados.'
        : dados?.error?.message ?? `WhatsApp respondeu ${res.status}`
      return { ok: false, erro }
    }
    return { ok: true, id: dados?.messages?.[0]?.id ?? null }
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : 'Falha de rede ao contactar o WhatsApp.' }
  }
}

// ─── A que reserva pertence uma mensagem que chega ─────────────────────────

interface ReservaCurta { id: string; hospede_id: string | null; owner_id: string | null; check_in: string; check_out: string; estado: string }

/**
 * Reserva mais relevante de um hóspede: a que está a decorrer ou é a próxima;
 * senão a última. Uma mensagem do hóspede fala quase sempre da estadia que aí
 * vem ou que está a acontecer.
 */
export function reservaMaisRelevante<T extends ReservaCurta>(reservas: T[], hoje: string): T | null {
  const ativas = reservas.filter(r => r.estado !== 'cancelada')
  const lista = ativas.length ? ativas : reservas
  const futuras = lista.filter(r => r.check_out >= hoje).sort((a, b) => a.check_in.localeCompare(b.check_in))
  if (futuras.length) return futuras[0]
  return [...lista].sort((a, b) => b.check_out.localeCompare(a.check_out))[0] ?? null
}

export async function reservaDoTelefone(
  supabase: SupabaseClient,
  ownerId: string,
  telefone: string,
  hoje: string,
): Promise<{ reserva_id: string | null; hospede_id: string | null; nome: string | null }> {
  const alvo = normalizarTelefone(telefone)
  if (!alvo) return { reserva_id: null, hospede_id: null, nome: null }
  const { data: hospedes } = await supabase
    .from('guests')
    .select('id, nome, telefone')
    .eq('owner_id', ownerId)
    .not('telefone', 'is', null)
    .limit(5000)
  const encontrados = (hospedes ?? []).filter(h => normalizarTelefone(h.telefone) === alvo)
  if (!encontrados.length) return { reserva_id: null, hospede_id: null, nome: null }
  const { data: reservas } = await supabase
    .from('bookings')
    .select('id, hospede_id, owner_id, check_in, check_out, estado')
    .eq('owner_id', ownerId)
    .in('hospede_id', encontrados.map(h => h.id))
  const r = reservaMaisRelevante((reservas ?? []) as ReservaCurta[], hoje)
  const hospede = encontrados.find(h => h.id === r?.hospede_id) ?? encontrados[0]
  return { reserva_id: r?.id ?? null, hospede_id: hospede.id, nome: hospede.nome ?? null }
}

/**
 * Reserva de um email que chegou sem endereço de resposta válido (o hóspede
 * escreveu para o endereço de receção à mão, ou respondeu a um email antigo).
 * Só se aceita quando o remetente é hóspede de **um só** anfitrião — com dois,
 * não há forma segura de escolher a caixa.
 */
export async function reservaDoEmail(
  supabase: SupabaseClient,
  email: string,
  hoje: string,
): Promise<{ owner_id: string; reserva_id: string | null; hospede_id: string } | null> {
  const { data: hospedes } = await supabase
    .from('guests')
    .select('id, owner_id')
    .ilike('email', email)
    .limit(20)
  const donos = new Set((hospedes ?? []).map(h => h.owner_id).filter(Boolean))
  if (donos.size !== 1) return null
  const ownerId = [...donos][0] as string
  const ids = (hospedes ?? []).map(h => h.id)
  const { data: reservas } = await supabase
    .from('bookings')
    .select('id, hospede_id, owner_id, check_in, check_out, estado')
    .eq('owner_id', ownerId)
    .in('hospede_id', ids)
  const r = reservaMaisRelevante((reservas ?? []) as ReservaCurta[], hoje)
  return { owner_id: ownerId, reserva_id: r?.id ?? null, hospede_id: r?.hospede_id ?? ids[0] }
}

export type NovaMensagem = Omit<Mensagem, 'id' | 'criado_em' | 'lida_em' | 'erro' | 'id_externo' | 'nome_contacto' | 'assunto' | 'sugerida_por_ia'> &
  Partial<Pick<Mensagem, 'lida_em' | 'erro' | 'id_externo' | 'nome_contacto' | 'assunto' | 'sugerida_por_ia' | 'criado_em'>>

/**
 * Grava uma mensagem. Um `id_externo` repetido (o fornecedor reenviou o
 * webhook) não é erro: a mensagem já lá está.
 */
export async function gravarMensagem(supabase: SupabaseClient, m: NovaMensagem): Promise<{ ok: boolean; duplicada?: boolean; mensagem?: Mensagem; erro?: string }> {
  const { data, error } = await supabase.from('mensagens').insert(m).select('*').single()
  if (error) {
    if (error.code === '23505') return { ok: true, duplicada: true }
    return { ok: false, erro: error.message }
  }
  return { ok: true, mensagem: data as Mensagem }
}

/**
 * Regista na conversa da reserva um email que a aplicação mandou sozinha
 * (pedido recebido, confirmação, lembrete de pagamento, automação).
 *
 * Sem isto o anfitrião abria a conversa sem ver o que o hóspede já tinha
 * recebido — e a sugestão da IA também não, propondo reenviar instruções que
 * já tinham saído. Só se grava o que saiu: um envio falhado é um problema do
 * cron, não uma mensagem. Nunca lança — o email já foi; perder o registo não
 * pode fazer o chamador repetir o envio.
 */
export async function registarEmailAutomatico(
  supabase: SupabaseClient,
  p: {
    ownerId: string | null | undefined
    reservaId: string
    hospedeId: string | null | undefined
    para: string
    assunto: string | null | undefined
    corpo: string
    origem: OrigemMensagem
    envio: { ok: boolean; id?: string }
  },
): Promise<void> {
  if (!p.ownerId || !p.envio.ok) return
  const corpo = p.corpo.trim().slice(0, LIMITE_CORPO)
  if (!corpo) return
  try {
    const r = await gravarMensagem(supabase, {
      owner_id: p.ownerId,
      reserva_id: p.reservaId,
      hospede_id: p.hospedeId ?? null,
      canal: 'email',
      direcao: 'saida',
      estado: 'enviada',
      assunto: p.assunto?.slice(0, LIMITE_ASSUNTO) ?? null,
      corpo,
      contacto: enderecoEmail(p.para),
      id_externo: p.envio.id ?? null,
      origem: p.origem,
    })
    if (!r.ok) console.error('[mensagens] registo de email automático falhou', p.reservaId, r.erro)
  } catch (err) {
    console.error('[mensagens] registo de email automático falhou', p.reservaId, err)
  }
}

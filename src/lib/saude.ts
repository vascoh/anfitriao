import 'server-only'
import { createAdminClient } from './supabase'
import { diagnosticarEmail } from './email/config'
import { estaConfigurada as encriptacaoConfigurada } from './crypto'
import { today, addDays } from './utils'

/**
 * Estado de saúde do sistema, numa página que se abre.
 *
 * Não substitui o Sentry — substitui o **nada**. A história deste projeto é de
 * falhas silenciosas: os emails estiveram semanas desligados porque a
 * `RESEND_API_KEY` não existia e ninguém tinha onde ver isso; o `robots.txt`
 * esteve meses bloqueado pelo middleware; a sincronização iCal nunca aplicou
 * um cancelamento. Nenhuma destas coisas dá erro — dão **ausência**, que é
 * precisamente o que não salta à vista.
 *
 * Por isso esta página pergunta pelo que **devia ter acontecido e não
 * aconteceu**, não pelo que rebentou.
 */

export type Nivel = 'ok' | 'aviso' | 'erro'

export interface Verificacao {
  chave: string
  titulo: string
  nivel: Nivel
  detalhe: string
  /** O que fazer, quando há o que fazer. */
  accao?: string
}

function env(nome: string): boolean {
  return Boolean(process.env[nome])
}

/** Configuração: o que está por definir e o que isso desliga. */
export function verificarConfiguracao(): Verificacao[] {
  const v: Verificacao[] = []

  for (const problema of diagnosticarEmail()) {
    v.push({
      chave: 'email',
      titulo: 'Envio de email',
      nivel: problema.nivel === 'erro' ? 'erro' : 'aviso',
      detalhe: problema.mensagem,
      accao: 'Definir RESEND_API_KEY e EMAIL_FROM nas variáveis de ambiente.',
    })
  }
  if (diagnosticarEmail().length === 0) {
    v.push({ chave: 'email', titulo: 'Envio de email', nivel: 'ok', detalhe: 'Configurado.' })
  }

  v.push(encriptacaoConfigurada()
    ? { chave: 'cripto', titulo: 'Chave de encriptação', nivel: 'ok', detalhe: 'Definida — documentos e credenciais são guardados cifrados.' }
    : {
        chave: 'cripto', titulo: 'Chave de encriptação', nivel: 'erro',
        detalhe: 'APP_ENCRYPTION_KEY em falta: a app recusa guardar credenciais do SIBA e criar contas de faturação.',
        accao: 'openssl rand -base64 32',
      })

  v.push(env('INVOICEXPRESS_PARTNER_API_KEY')
    ? { chave: 'faturacao', titulo: 'Faturação certificada', nivel: 'ok', detalhe: 'Chave de parceiro definida.' }
    : {
        chave: 'faturacao', titulo: 'Faturação certificada', nivel: 'aviso',
        detalhe: 'Sem INVOICEXPRESS_PARTNER_API_KEY: a página de faturação diz que não está disponível.',
      })

  v.push(env('STRIPE_EMPRESA_PRICE_ID')
    ? { chave: 'stripe', titulo: 'Plano Empresa no Stripe', nivel: 'ok', detalhe: 'Price ID definido.' }
    : {
        chave: 'stripe', titulo: 'Plano Empresa no Stripe', nivel: 'aviso',
        detalhe: 'O plano existe no código e na página de preços, mas não tem Price ID: o checkout falha.',
      })

  const clerkDev = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').startsWith('pk_test')
  v.push(clerkDev
    ? {
        chave: 'clerk', titulo: 'Autenticação', nivel: 'aviso',
        detalhe: 'Clerk em instância de desenvolvimento — não deve servir utilizadores reais.',
      }
    : { chave: 'clerk', titulo: 'Autenticação', nivel: 'ok', detalhe: 'Instância de produção.' })

  return v
}

/** O que devia ter acontecido nos últimos dias e não aconteceu. */
export async function verificarOperacao(): Promise<Verificacao[]> {
  const supabase = createAdminClient()
  const v: Verificacao[] = []
  const hoje = today()
  const ontem = addDays(hoje, -1)

  // ── Feeds iCal com erro ─────────────────────────────────────────────────
  const { data: props } = await supabase
    .from('properties')
    .select('nome, ical_feeds')
    .not('owner_id', 'is', null)

  const feeds = (props ?? []).flatMap(p =>
    ((p.ical_feeds as Array<{ nome?: string; error?: string; last_sync?: string }> | null) ?? [])
      .map(f => ({ propriedade: p.nome as string, ...f })),
  )
  const comErro = feeds.filter(f => f.error)
  const desatualizados = feeds.filter(f => !f.error && (!f.last_sync || f.last_sync.slice(0, 10) < ontem))

  if (feeds.length === 0) {
    v.push({ chave: 'ical', titulo: 'Calendários externos', nivel: 'aviso', detalhe: 'Nenhum feed iCal ligado.' })
  } else if (comErro.length > 0) {
    v.push({
      chave: 'ical', titulo: 'Calendários externos', nivel: 'erro',
      detalhe: `${comErro.length} de ${feeds.length} feeds com erro: ${comErro.map(f => `${f.propriedade} (${f.error})`).slice(0, 3).join('; ')}`,
    })
  } else if (desatualizados.length > 0) {
    v.push({
      chave: 'ical', titulo: 'Calendários externos', nivel: 'aviso',
      detalhe: `${desatualizados.length} feeds sem sincronizar desde ontem — o cron corre às 04:00.`,
    })
  } else {
    v.push({ chave: 'ical', titulo: 'Calendários externos', nivel: 'ok', detalhe: `${feeds.length} feeds sincronizados.` })
  }

  // ── SIBA ────────────────────────────────────────────────────────────────
  const { data: siba } = await supabase
    .from('bookings')
    .select('id, siba_status, check_in')
    .in('siba_status', ['falhou', 'nao_submetido'])
    .lt('check_in', hoje)
    .limit(50)

  const falhadas = (siba ?? []).filter(b => b.siba_status === 'falhou')
  const porSubmeter = (siba ?? []).filter(b => b.siba_status === 'nao_submetido')

  if (falhadas.length > 0) {
    v.push({
      chave: 'siba', titulo: 'Boletins do SIBA', nivel: 'erro',
      detalhe: `${falhadas.length} submissões falhadas em reservas já iniciadas.`,
      accao: 'Ver /conformidade e reenviar.',
    })
  } else if (porSubmeter.length > 0) {
    v.push({
      chave: 'siba', titulo: 'Boletins do SIBA', nivel: 'aviso',
      detalhe: `${porSubmeter.length} reservas já iniciadas sem boletim entregue. O prazo legal são 3 dias úteis.`,
    })
  } else {
    v.push({ chave: 'siba', titulo: 'Boletins do SIBA', nivel: 'ok', detalhe: 'Sem boletins em atraso.' })
  }

  // ── Faturação ───────────────────────────────────────────────────────────
  const { data: faturas } = await supabase
    .from('bookings')
    .select('id, fatura_estado, fatura_erro')
    .eq('fatura_estado', 'falhou')
    .limit(50)

  v.push((faturas ?? []).length > 0
    ? {
        chave: 'faturas', titulo: 'Faturação', nivel: 'erro',
        detalhe: `${faturas!.length} faturas por emitir com erro: ${faturas![0].fatura_erro ?? 'sem detalhe'}`,
      }
    : { chave: 'faturas', titulo: 'Faturação', nivel: 'ok', detalhe: 'Sem faturas em erro.' })

  // ── Automações: correu ontem? ───────────────────────────────────────────
  const { data: automacoes } = await supabase
    .from('automation_log')
    .select('executado_em')
    .order('executado_em', { ascending: false })
    .limit(1)

  const ultima = (automacoes ?? [])[0]?.executado_em as string | undefined
  v.push({
    chave: 'automacoes', titulo: 'Motor de automações',
    nivel: 'ok',
    detalhe: ultima
      ? `Último envio: ${ultima.slice(0, 16).replace('T', ' ')}.`
      : 'Ainda não enviou nada — normal se não houver automações ativas ou reservas nas datas dos gatilhos.',
  })

  return v
}

export function piorNivel(verificacoes: Verificacao[]): Nivel {
  if (verificacoes.some(v => v.nivel === 'erro')) return 'erro'
  if (verificacoes.some(v => v.nivel === 'aviso')) return 'aviso'
  return 'ok'
}

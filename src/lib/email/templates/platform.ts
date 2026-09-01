import { escHtml } from '@/lib/utils'
import { renderEmail, platformTheme, kicker, heading, paragraph, ctaButton, detailsTable, noteBox } from './layout'

/** Plataforma: itens de conformidade a expirar ou já expirados. */
export function complianceAlertEmail(p: {
  firstName: string
  /** Uma linha por item: alojamento, item e estado já em texto. */
  linhas: Array<[string, string]>
  temExpirado: boolean
  baseUrl: string
}): string {
  const theme = platformTheme()
  return renderEmail(theme, `
    ${kicker(p.temExpirado ? 'Ação necessária' : 'Aviso de prazo', theme)}
    ${heading(p.temExpirado ? 'Tens documentos expirados' : 'Tens documentos a expirar')}
    ${paragraph(`Olá ${escHtml(p.firstName)}, ${p.temExpirado
      ? 'há obrigações legais do teu Alojamento Local fora de prazo.'
      : 'há obrigações legais do teu Alojamento Local a aproximarem-se do prazo.'}`)}
    ${detailsTable(p.linhas, theme, { title: 'O que precisa de atenção' })}
    ${p.temExpirado
      ? noteBox(
          'Porque importa',
          'A caducidade do seguro de responsabilidade civil é causa de cancelamento do registo de Alojamento Local (DL 128/2014, art. 13.º-A).',
          theme,
        )
      : ''}
    ${ctaButton('Ver conformidade →', `${p.baseUrl}/conformidade`, theme)}
    ${paragraph('Assim que renovares, atualiza a data no cofre de conformidade e deixamos de te avisar.')}
  `)
}

/** Plataforma: resumo mensal de desempenho. */
export function relatorioMensalEmail(p: {
  firstName: string
  mesLabel: string
  destaque: string
  variacao: string | null
  metricas: Array<[string, string]>
  porOrigem: Array<[string, string]>
  baseUrl: string
}): string {
  const theme = platformTheme()
  return renderEmail(theme, `
    ${kicker(`Resumo de ${p.mesLabel}`, theme)}
    ${heading(p.destaque)}
    ${paragraph(`Olá ${escHtml(p.firstName)}, aqui fica o resumo do mês${p.variacao ? ` — ${escHtml(p.variacao)}` : ''}.`)}
    ${detailsTable(p.metricas, theme, { title: 'Desempenho' })}
    ${p.porOrigem.length ? detailsTable(p.porOrigem, theme, { title: 'Receita por origem' }) : ''}
    ${ctaButton('Ver relatórios completos →', `${p.baseUrl}/relatorios`, theme)}
    ${paragraph('Podes reencaminhar este email ao teu contabilista.')}
  `)
}

/** Plataforma: noites órfãs detetadas no calendário. */
export function noitesOrfasEmail(p: {
  firstName: string
  /** Uma linha por buraco: alojamento+datas → sugestão. */
  linhas: Array<[string, string]>
  baseUrl: string
}): string {
  const theme = platformTheme()
  const n = p.linhas.length
  return renderEmail(theme, `
    ${kicker('Oportunidade de receita', theme)}
    ${heading(n === 1 ? 'Tens uma noite por encher' : `Tens ${n} buracos no calendário`)}
    ${paragraph(`Olá ${escHtml(p.firstName)}, encontrámos ${n === 1 ? 'um buraco curto' : 'buracos curtos'} entre reservas. São noites difíceis de vender ao preço normal, porque quase ninguém procura estadias tão curtas com datas fixas.`)}
    ${detailsTable(p.linhas, theme, { title: 'Onde e quanto baixar' })}
    ${noteBox(
      'Como funciona a sugestão',
      'A percentagem tem em conta o tamanho do buraco e a proximidade da data. É um ponto de partida, não uma regra — decides tu.',
      theme,
    )}
    ${ctaButton('Abrir calendário →', `${p.baseUrl}/calendario`, theme)}
  `)
}

/** Plataforma: trial a expirar (3 dias / 1 dia). */
export function trialEndingEmail(p: { firstName: string; daysLeft: number; trialDate: string; baseUrl: string }): string {
  const theme = platformTheme()
  const urgent = p.daysLeft === 1
  return renderEmail(theme, `
    ${kicker(urgent ? 'Último dia' : 'O teu trial está a acabar', theme)}
    ${heading(urgent ? 'O teu trial termina amanhã' : `Faltam ${p.daysLeft} dias de trial`)}
    ${paragraph(`Olá ${escHtml(p.firstName)}, o teu período experimental termina a <strong>${escHtml(p.trialDate)}</strong>. Para continuares a usar o calendário, o check-in online e o boletim SIBA sem interrupções, ativa a tua subscrição.`)}
    ${ctaButton('Ativar subscrição →', `${p.baseUrl}/conta/billing`, theme)}
    ${paragraph('Se precisares de ajuda ou tiveres questões, basta responder a este email.')}
  `)
}

/** Plataforma: trial expirou hoje. */
export function trialExpiredEmail(p: { firstName: string; baseUrl: string }): string {
  const theme = platformTheme()
  return renderEmail(theme, `
    ${kicker('Trial terminado', theme)}
    ${heading('O teu trial expirou hoje')}
    ${paragraph(`Olá ${escHtml(p.firstName)}, o teu período experimental chegou ao fim. Os teus dados estão guardados — ativa a subscrição para voltares a ter acesso ao painel.`)}
    ${ctaButton('Reativar conta →', `${p.baseUrl}/conta/billing`, theme)}
  `)
}

/**
 * Plataforma: um canal parou de responder.
 *
 * O que este email tem de dizer não é «há um erro» — é o que esse erro está a
 * custar. Desde que a disponibilidade é confirmada ao vivo antes de aceitar
 * uma reserva (`lib/disponibilidade-ao-vivo.ts`), um calendário que não
 * responde faz **recusar reservas diretas**. Quem recebe isto não vê recusas:
 * vê um mês fraco, semanas depois, sem o ligar a nada.
 */
export function canaisEmRiscoEmail(p: {
  firstName: string
  /** Uma linha por canal: onde, e o que fazer. */
  linhas: Array<[string, string]>
  temErro: boolean
  baseUrl: string
}): string {
  const theme = platformTheme()
  return renderEmail(theme, `
    ${kicker(p.temErro ? 'Ação necessária' : 'A confirmar', theme)}
    ${heading(p.temErro
      ? 'Um canal parou de responder'
      : 'Um canal está sem leituras há mais de um dia')}
    ${paragraph(`Olá ${escHtml(p.firstName)}, ${p.linhas.length === 1
      ? 'um dos teus calendários não está a ser lido.'
      : `${p.linhas.length} dos teus calendários não estão a ser lidos.`}`)}
    ${detailsTable(p.linhas, theme, { title: 'O que precisa de atenção' })}
    ${noteBox(
      'O que isto está a custar',
      'Antes de aceitar uma reserva, confirmamos com as plataformas se a data continua livre. Quando um calendário não responde, a reserva é recusada em vez de aceite às cegas — é o que evita vender a mesma noite duas vezes. Enquanto este canal estiver assim, podes estar a perder reservas diretas sem dar por isso.',
      theme,
    )}
    ${ctaButton('Ver os canais →', `${p.baseUrl}/canais`, theme)}
    ${paragraph('Quase sempre resolve-se copiando o endereço atual na plataforma e substituindo o que está guardado.')}
  `)
}

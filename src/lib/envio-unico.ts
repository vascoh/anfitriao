import 'server-only'
import { createAdminClient } from './supabase'

/**
 * "Este aviso já saiu?" — respondido de maneira que aguenta duas execuções ao
 * mesmo tempo.
 *
 * Os crons de aviso não guardavam rasto do que enviavam. Bastava uma segunda
 * execução no mesmo dia para o mesmo email sair outra vez: um lembrete de fim
 * de período experimental repetido lê-se como cobrança, e um alerta de
 * documento a expirar repetido ensina o anfitrião a ignorar todos os outros.
 *
 * A verificação **não** pode ser "ler e depois escrever": entre as duas coisas
 * cabe a outra execução, e ambas concluem que ainda ninguém enviou. Quem
 * reserva é quem consegue inserir a chave primária — a base de dados decide,
 * e decide uma vez só.
 *
 * Protocolo: reservar → enviar → libertar se o envio falhar. Libertar é o que
 * faz a diferença entre "não repetir" e "perder o aviso": um Resend em baixo
 * às 10:00 não pode custar o aviso de amanhã.
 */

/** Tenta reservar. `true` = é esta execução que envia. */
export async function reservarEnvio(chave: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('envios_unicos').insert({ chave })

  if (!error) return true

  // 23505 = chave duplicada: alguém já reservou, e não é um erro nosso.
  if (error.code === '23505') return false

  /* Qualquer outra falha (base indisponível, permissões) não pode impedir o
   * aviso de sair: mais vale um email repetido do que um anfitrião a perder o
   * prazo de um seguro por causa de uma tabela auxiliar. */
  console.error('[envio-unico] reserva falhou, envia à mesma:', error.message)
  return true
}

/** Devolve a reserva quando o envio não chegou a acontecer. */
export async function libertarEnvio(chave: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('envios_unicos').delete().eq('chave', chave)
  if (error) console.error('[envio-unico] libertar', error.message)
}

/** Chave de um aviso: junta o destinatário ao que o torna irrepetível. */
export function chaveDeEnvio(tipo: string, destinatario: string, periodo: string): string {
  return `${tipo}:${destinatario}:${periodo}`
}

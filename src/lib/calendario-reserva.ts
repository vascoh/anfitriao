/**
 * Regras do calendário de reserva do site público, sem React — para se
 * poderem testar e para o calendário e o resumo nunca discordarem.
 *
 * Uma data ocupada é uma **noite** ocupada: quem sai a 12 liberta a noite de
 * 12, por isso o dia de saída pode coincidir com o primeiro dia ocupado de
 * outra reserva, mas nunca passar por cima dele.
 */

export interface Selecao {
  entrada: string | null
  saida: string | null
}

export const SEM_SELECAO: Selecao = { entrada: null, saida: null }

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/** Dias do mês numa grelha de semanas a começar à segunda; `null` preenche. */
export function gradeDoMes(ano: number, mes: number): (string | null)[] {
  const primeiro = new Date(ano, mes, 1)
  const total = new Date(ano, mes + 1, 0).getDate()
  const vazios = (primeiro.getDay() + 6) % 7
  const dias: (string | null)[] = Array(vazios).fill(null)
  for (let d = 1; d <= total; d++) dias.push(iso(ano, mes, d))
  while (dias.length % 7 !== 0) dias.push(null)
  return dias
}

/** Mês seguinte (ou anterior, com `passo` negativo), com a volta do ano. */
export function somarMeses(ano: number, mes: number, passo: number): { ano: number; mes: number } {
  const n = ano * 12 + mes + passo
  return { ano: Math.floor(n / 12), mes: ((n % 12) + 12) % 12 }
}

/** Primeira noite ocupada depois da entrada: o limite para a saída. */
export function limiteDeSaida(entrada: string, ocupadasOrdenadas: string[]): string | null {
  return ocupadasOrdenadas.find(d => d > entrada) ?? null
}

/**
 * Um clique no calendário. Devolve a nova seleção e, quando o hóspede tenta
 * atravessar uma noite ocupada, `atravessa: true` — a entrada mantém-se para
 * ele só ter de escolher outra saída.
 */
export function escolherDia(
  atual: Selecao,
  dia: string,
  ocupadasOrdenadas: string[],
): { selecao: Selecao; atravessa: boolean } {
  if (!atual.entrada || atual.saida || dia <= atual.entrada) {
    return { selecao: { entrada: dia, saida: null }, atravessa: false }
  }
  const limite = limiteDeSaida(atual.entrada, ocupadasOrdenadas)
  if (limite && dia > limite) return { selecao: atual, atravessa: true }
  return { selecao: { entrada: atual.entrada, saida: dia }, atravessa: false }
}

/** Este dia pode ser clicado agora? */
export function diaDisponivel(
  dia: string,
  atual: Selecao,
  minimo: string,
  ocupadas: Set<string>,
  ocupadasOrdenadas: string[],
): boolean {
  if (dia < minimo) return false
  if (atual.entrada && !atual.saida && dia > atual.entrada) {
    const limite = limiteDeSaida(atual.entrada, ocupadasOrdenadas)
    return !limite || dia <= limite
  }
  return !ocupadas.has(dia)
}

/** O dia está entre a entrada e a saída escolhidas (sem as incluir). */
export function dentroDaSelecao(dia: string, s: Selecao): boolean {
  return Boolean(s.entrada && s.saida && dia > s.entrada && dia < s.saida)
}

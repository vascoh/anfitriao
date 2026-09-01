import 'server-only'

/**
 * Ler **todas** as linhas, e não as primeiras mil.
 *
 * O PostgREST do Supabase corta qualquer resposta a 1000 linhas. Não é um erro,
 * não vem aviso nenhum: a consulta responde 200 com mil linhas e o resto
 * desaparece. Verificado neste projeto — 2500 linhas pedidas, 1000 devolvidas.
 *
 * Enquanto um anfitrião tem uma casa, mil reservas são anos de trabalho e nunca
 * ninguém dá por isto. Num alojamento de 40 quartos são cerca de três meses —
 * e a partir daí o calendário mostra noites livres que estão ocupadas, os
 * relatórios do ano passado vêm vazios e a declaração da taxa turística sai
 * por baixo do que é devido. O erro não se anuncia em lado nenhum: os números
 * aparecem, só que são outros.
 *
 * Por isso esta função existe e por isso é usada em tudo o que tem de estar
 * completo — contas, declarações, exportações. Onde a resposta pode ser
 * parcial (uma lista que se percorre, uma pesquisa), mais vale pedir menos:
 * paginar dez vezes para mostrar as dez primeiras é desperdício.
 */

const PAGINA = 1000

/** Uma consulta do supabase-js que aceita `.range()` e devolve linhas. */
interface Paginavel<T> {
  range(de: number, ate: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>
}

/**
 * Corre a consulta em páginas até ela deixar de vir cheia.
 *
 * `construir` é chamada uma vez por página porque um construtor do supabase-js
 * não se pode reutilizar depois de executado — reaproveitá-lo devolveria a
 * mesma página vezes sem conta.
 *
 * ⚠️ **A consulta tem de terminar numa ordenação única.** Cada página é um
 * `SELECT` novo, e sem `ORDER BY` o Postgres não promete devolver as linhas
 * pela mesma ordem duas vezes — nem sequer promete uma ordem. Ordenar por uma
 * coluna com repetições (`check_in`, `criado_em`, `data`) não chega: as linhas
 * empatadas em cima da fronteira das mil podem trocar de lugar entre a página
 * que acabou e a que começa, e então uma vem duas vezes e outra não vem
 * nenhuma. Numa função que existe para as respostas estarem **completas**, uma
 * linha que desaparece é uma noite por declarar.
 *
 * Por isso todas as consultas daqui acabam em `.order('id')` — o desempate que
 * a chave primária garante. Ordena-se pelo que interessa primeiro, e por `id`
 * a seguir.
 */
export async function carregarTudo<T>(
  construir: () => Paginavel<T>,
  maximo = 50_000,
): Promise<{ linhas: T[]; erro?: string }> {
  const linhas: T[] = []

  for (let inicio = 0; inicio < maximo; inicio += PAGINA) {
    const { data, error } = await construir().range(inicio, inicio + PAGINA - 1)
    if (error) return { linhas, erro: error.message }

    const pagina = data ?? []
    linhas.push(...pagina)

    // Página incompleta significa fim dos dados — e poupa uma ida à base.
    if (pagina.length < PAGINA) return { linhas }
  }

  /* Chegar ao teto é improvável e não pode passar em silêncio: seria repetir o
   * problema que esta função existe para resolver, só que mais acima. */
  console.error(`[carregarTudo] teto de ${maximo} linhas atingido — a resposta pode estar incompleta`)
  return { linhas }
}

import 'server-only'
import { fetchIcalText } from './ical-fetch'
import { parseIcal } from './ical'
import type { IcalFeed } from './types'

/**
 * Perguntar às plataformas, agora, se a noite ainda está livre.
 *
 * ## Porque é que a base de dados não chega
 *
 * A sincronização corre **uma vez por dia, às 04:00** (`vercel.json`), e no
 * plano Hobby da Vercel os cron jobs não podem correr mais vezes do que isso.
 * Entre duas passagens, o que a nossa base sabe sobre o calendário do Amenitiz
 * pode ter até 24 horas. Para *mostrar* o calendário, isso é um incómodo. Para
 * **aceitar uma reserva**, é a definição de dupla reserva: alguém reserva no
 * Airbnb às 05:00, o nosso site vende a mesma noite às 11:00, e as duas
 * pessoas aparecem à porta com uma confirmação na mão.
 *
 * O caminho curto não é sincronizar mais vezes — é perguntar no único momento
 * em que a resposta tem de estar certa. São os mesmos feeds, lidos no
 * segundo em que se carrega em confirmar. Um a dois segundos, uma vez por
 * reserva.
 *
 * ## Fecha-se por omissão
 *
 * Se um feed não responde, esta função diz **indisponível**, não «livre». É
 * uma escolha, e tem um custo que é preciso conhecer: um feed partido — um
 * endereço do Airbnb que expirou, por exemplo — **trava as reservas diretas
 * até ser arranjado**. Preferiu-se isso a vender uma noite às cegas: perder
 * uma reserva é reversível e aparece em `/canais` como feed «desatualizado»;
 * uma dupla reserva é uma pessoa sem casa e uma penalização da plataforma.
 *
 * A exceção é depois do pagamento (ver `hasConflict` em `booking-request.ts`):
 * aí uma falha de rede não pode desfazer um pagamento já feito, e só uma
 * sobreposição **de facto** trava a reserva.
 */

/* Curto de propósito: há um hóspede à espera, e a função onde isto corre tem
 * um teto de execução. Os feeds são lidos em paralelo, portanto o pior caso é
 * um destes limites e não a soma deles — mas com o resto do pedido por cima,
 * quatro segundos é o que cabe com folga. Ver `fetchIcalText`. */
const TIMEOUT_MS = 4_000

export type ResultadoAoVivo =
  | { livre: true }
  /** Uma plataforma tem esta data ocupada. */
  | { livre: false; motivo: 'ocupado'; feed: string }
  /** Não se conseguiu saber. Não é o mesmo que estar livre. */
  | { livre: false; motivo: 'indisponivel'; feed: string; detalhe: string }

/** Intervalos meio-abertos `[entrada, saída[`: sair no dia em que outro entra não é conflito. */
function sobrepoe(a: { inicio: string; fim: string }, b: { inicio: string; fim: string }): boolean {
  return a.inicio < b.fim && a.fim > b.inicio
}

/**
 * As datas ainda estão livres em todos os feeds destes alojamentos?
 *
 * Os feeds são lidos em paralelo: com três quartos, em série gastavam-se três
 * vezes o tempo por nada. Sem feeds configurados não há nada a perguntar e a
 * resposta é «livre» — a verificação contra a base, essa, corre sempre.
 */
export async function verificarDisponibilidadeAoVivo(
  alojamentos: Array<{ nome?: string; ical_feeds?: IcalFeed[] | null }>,
  checkIn: string,
  checkOut: string,
  opcoes: {
    /**
     * UID de origem a ignorar — a reserva que está a ser alterada.
     *
     * Sem isto, editar uma reserva **importada** era impossível: o evento que
     * o feed devolve é essa mesma reserva, e a verificação recusava-a por
     * conflito consigo própria. A verificação contra a base sempre se excluiu
     * a si mesma (`.neq('id', …)`); esta não tinha como, porque do outro lado
     * a reserva não se chama pelo nosso `id` — chama-se pelo UID da
     * plataforma, que é o que `uid_externo` guarda.
     */
    ignorarUid?: string | null
  } = {},
): Promise<ResultadoAoVivo> {
  const feeds = alojamentos.flatMap(a =>
    (a.ical_feeds ?? []).map(f => ({ feed: f, alojamento: a.nome ?? '' })),
  )

  if (feeds.length === 0) return { livre: true }

  const leituras = await Promise.all(
    feeds.map(async ({ feed, alojamento }) => {
      const etiqueta = alojamento ? `${alojamento} · ${feed.nome}` : feed.nome
      try {
        const eventos = parseIcal(await fetchIcalText(feed.url, TIMEOUT_MS))
        return { etiqueta, eventos, erro: null as string | null }
      } catch (err) {
        return {
          etiqueta,
          eventos: [],
          erro: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  /* Uma ocupação encontrada vale mais do que uma falha de leitura: se um feed
   * já disse que a noite está vendida, a resposta é essa, e não «não se
   * conseguiu saber». */
  for (const { etiqueta, eventos } of leituras) {
    for (const ev of eventos) {
      if (!ev.dtstart || !ev.dtend || ev.dtstart >= ev.dtend) continue
      // A reserva não choca consigo própria — ver `ignorarUid`.
      if (opcoes.ignorarUid && ev.uid === opcoes.ignorarUid) continue
      if (sobrepoe({ inicio: ev.dtstart, fim: ev.dtend }, { inicio: checkIn, fim: checkOut })) {
        return { livre: false, motivo: 'ocupado', feed: etiqueta }
      }
    }
  }

  const falhada = leituras.find(l => l.erro)
  if (falhada) {
    return {
      livre: false,
      motivo: 'indisponivel',
      feed: falhada.etiqueta,
      detalhe: falhada.erro as string,
    }
  }

  return { livre: true }
}

/** O que se diz a quem está do outro lado do ecrã, sem lhe dar os nossos problemas. */
export function mensagemAoVivo(r: Extract<ResultadoAoVivo, { livre: false }>): string {
  return r.motivo === 'ocupado'
    ? 'Estas datas acabaram de ser reservadas noutra plataforma.'
    : 'Não foi possível confirmar a disponibilidade neste momento. Tenta daqui a alguns minutos ou fala connosco diretamente.'
}

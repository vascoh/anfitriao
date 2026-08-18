import { toast } from 'sonner'

/**
 * Escrever no servidor e **olhar para a resposta**.
 *
 * Vinte e duas escritas do lado do cliente faziam `await fetch(...)` e seguiam
 * caminho sem ver o que tinha voltado: mudavam o ecrã, mostravam "Guardado" e
 * navegavam para outra página. Quando o servidor recusava — limite do plano
 * atingido, sem permissão, um alojamento com faturas que não se pode apagar,
 * uma coluna que a base rejeitou — o anfitrião via exatamente o mesmo que
 * quando corria bem. Só dava por ela mais tarde, ao reparar que a alteração
 * não estava lá; e a essa altura já não liga uma coisa à outra.
 *
 * O servidor já explicava tudo isto no corpo da resposta. Ninguém o lia.
 *
 * `guardar` devolve `true` só quando a escrita chegou ao fim, e mostra a
 * mensagem do servidor quando não chegou. Quem chama decide o resto: um
 * `if (!await guardar(...)) return` evita o "Guardado" que mente.
 */

interface Opcoes {
  /** Substitui a mensagem do servidor por uma explicação nossa. */
  mensagemDeErro?: string
  /** Para casos em que o chamador prefere tratar o erro por si. */
  silencioso?: boolean
}

async function pedir(
  url: string,
  metodo: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  corpo?: unknown,
  opcoes: Opcoes = {},
): Promise<boolean> {
  let res: Response
  try {
    res = await fetch(url, {
      method: metodo,
      ...(corpo === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    })
  } catch {
    /* Sem rede. Vale a pena distinguir: "não foi possível guardar" leva a
     * pessoa a tentar outra vez, enquanto um erro do servidor não. */
    if (!opcoes.silencioso) {
      toast.error(opcoes.mensagemDeErro ?? 'Sem ligação. Verifica a internet e tenta outra vez.')
    }
    return false
  }

  if (res.ok) return true

  const json = await res.json().catch(() => ({})) as { error?: string }
  if (!opcoes.silencioso) {
    // A mensagem do servidor é quase sempre a mais útil: sabe o motivo exato.
    toast.error(opcoes.mensagemDeErro ?? json.error ?? 'Não foi possível guardar.', {
      duration: 8_000,
    })
  }
  return false
}

export function guardar(url: string, corpo: unknown, opcoes?: Opcoes): Promise<boolean> {
  return pedir(url, 'POST', corpo, opcoes)
}

export function eliminar(url: string, opcoes?: Opcoes): Promise<boolean> {
  return pedir(url, 'DELETE', undefined, opcoes)
}

/** Como `guardar`, mas devolve o corpo da resposta quando corre bem. */
export async function guardarComResposta<T>(
  url: string,
  corpo: unknown,
  opcoes: Opcoes = {},
): Promise<T | null> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    if (!opcoes.silencioso) {
      toast.error(opcoes.mensagemDeErro ?? 'Sem ligação. Verifica a internet e tenta outra vez.')
    }
    return null
  }

  const json = await res.json().catch(() => ({})) as T & { error?: string }
  if (res.ok) return json

  if (!opcoes.silencioso) {
    toast.error(opcoes.mensagemDeErro ?? json.error ?? 'Não foi possível guardar.', { duration: 8_000 })
  }
  return null
}

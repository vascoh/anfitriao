'use client'

import { AlertTriangle } from 'lucide-react'

/**
 * O que se mostra quando os dados não chegaram.
 *
 * Existe porque o contrário — não mostrar nada — é indistinguível de não haver
 * nada, e é sobre essa página que se decide. Um `fetch` sem `catch` deixa a
 * lista vazia ou o ecrã preso no «a carregar…» para sempre, sem um erro em
 * lado nenhum: o anfitrião vê zero reservas e conclui que o mês foi fraco, ou
 * vê uma declaração vazia e entrega-a assim.
 *
 * A frase tem de dizer as duas coisas: que falhou, e que o vazio não é
 * resposta. Por isso `aviso` — nas páginas onde o número serve para declarar
 * ou decidir, dizer «não assumas que está vazio» é a parte que importa.
 */
export function ErroAoCarregar({
  oQue,
  aviso,
  aoTentar,
}: {
  /** O que não carregou, para a frase: «Não foi possível carregar {oQue}». */
  oQue: string
  /** Consequência de tomar o vazio por bom, quando a há. */
  aviso?: string
  /** Se não for dado, recarrega a página. */
  aoTentar?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <p className="text-base font-semibold">Não foi possível carregar {oQue}</p>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        Pode ter sido uma falha de rede.{aviso ? ` ${aviso}` : ''}
      </p>
      <button
        onClick={aoTentar ?? (() => window.location.reload())}
        className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors"
      >
        Tentar outra vez
      </button>
    </div>
  )
}

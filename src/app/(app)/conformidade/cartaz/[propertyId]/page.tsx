import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase'
import { BotaoImprimir } from './botao-imprimir'

export const metadata: Metadata = {
  title: 'Aviso do Livro de Reclamações',
  robots: { index: false, follow: false },
}

/**
 * Cartaz A4 do Livro de Reclamações Eletrónico, pronto a afixar (DL 74/2017).
 *
 * Deliberadamente sem biblioteca de PDF: é uma página com CSS de impressão e o
 * anfitrião usa "Imprimir → Guardar como PDF" do próprio browser. Evita uma
 * dependência binária nova para um ganho marginal (mesma decisão tomada para o
 * .xlsx no financeiro, ver TODO.md).
 */
export default async function CartazPage({
  params,
}: {
  params: Promise<{ propertyId: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { propertyId } = await params
  const supabase = createAdminClient()

  const { data: p } = await supabase
    .from('properties')
    .select('nome, cidade, endereco, rnal_numero, owner_id')
    .eq('id', propertyId)
    .maybeSingle()

  if (!p) notFound()
  if (p.owner_id !== null && p.owner_id !== userId) notFound()

  return (
    <>
      <div className="mx-auto max-w-2xl print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Aviso para afixar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Imprime e afixa em local bem visível no alojamento. Para guardar em PDF, escolhe
          &laquo;Guardar como PDF&raquo; no destino de impressão.
        </p>
        <BotaoImprimir />
      </div>

      {/* ── Cartaz ─────────────────────────────────────────────── */}
      <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-white p-10 text-center text-black shadow-sm print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Livro de Reclamações
        </p>

        <h2 className="mt-6 text-3xl font-bold leading-tight">
          Este estabelecimento dispõe de<br />Livro de Reclamações Eletrónico
        </h2>

        <p className="mt-6 text-base leading-relaxed text-neutral-700">
          Pode apresentar a sua reclamação em qualquer momento, em
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight">
          www.livroreclamacoes.pt
        </p>

        <div className="mx-auto mt-10 max-w-sm border-t border-neutral-300 pt-6 text-sm text-neutral-700">
          <p className="font-semibold">{p.nome}</p>
          {p.endereco && <p className="mt-1">{p.endereco}</p>}
          {p.cidade && <p>{p.cidade}</p>}
          {p.rnal_numero && (
            <p className="mt-3 text-xs text-neutral-500">
              Registo Nacional de Alojamento Local n.º {p.rnal_numero}
            </p>
          )}
        </div>

        <p className="mt-10 text-[10px] leading-relaxed text-neutral-400">
          Decreto-Lei n.º 74/2017. O livro de reclamações eletrónico está disponível a todos os
          utentes, sem necessidade de o solicitar.
        </p>
      </div>
    </>
  )
}

import Link from 'next/link'
import { Home, TriangleAlert } from 'lucide-react'

/**
 * Marca um facto que só a empresa pode fornecer (denominação social, NIF,
 * morada, prazos de conservação). Fica deliberadamente berrante: uma página
 * legal com isto por preencher não deve conseguir passar despercebida.
 */
export function PorPreencher({ children }: { children: React.ReactNode }) {
  return (
    <mark className="mx-0.5 rounded-md bg-amber-400/20 px-1.5 py-0.5 font-semibold text-amber-300 ring-1 ring-amber-400/40">
      [POR PREENCHER: {children}]
    </mark>
  )
}

export function AvisoRevisao() {
  return (
    <aside className="not-prose mb-10 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
      <p className="text-sm leading-relaxed text-amber-200/90">
        <strong className="font-semibold text-amber-200">Rascunho por rever.</strong>{' '}
        Este texto foi redigido a partir do que a aplicação faz na realidade, mas
        não substitui aconselhamento jurídico. Tem de ser revisto por um
        advogado e ter os campos assinalados preenchidos antes de valer como
        documento legal.
      </p>
    </aside>
  )
}

export function PaginaLegal({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string
  atualizadoEm: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-32 sm:px-8 sm:py-40">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-cyan-400"
      >
        <Home className="size-4" aria-hidden />
        Voltar ao início
      </Link>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {titulo}
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        Última atualização:{' '}
        <time dateTime={atualizadoEm}>
          {new Date(atualizadoEm).toLocaleDateString('pt-PT', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </time>
      </p>

      <div className="mt-12">
        <AvisoRevisao />
        <div className="space-y-6 text-[15px] leading-relaxed text-slate-300 [&_a]:text-cyan-400 [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_li]:my-1.5 [&_strong]:font-semibold [&_strong]:text-white [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-white/10 [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:pb-2.5 [&_th]:pr-4 [&_th]:text-left [&_th]:font-semibold [&_th]:text-white [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </div>
  )
}

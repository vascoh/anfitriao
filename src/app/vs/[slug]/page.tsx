import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Check, X, Minus } from 'lucide-react'
import { CONCORRENTES, PRECOS_VERIFICADOS_EM, comparacaoPorSlug } from '@/lib/comparacoes'

export function generateStaticParams() {
  return CONCORRENTES.map(c => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = comparacaoPorSlug(slug)
  if (!c) return {}

  const title = `Anfitrião vs ${c.nome} — comparação honesta (${new Date(PRECOS_VERIFICADOS_EM).getFullYear()})`
  const description = `${c.nome} custa ${c.precoResumo}. Comparação lado a lado com o Anfitrião: preço, sincronização, check-in online e boletim SIBA. Incluindo onde o ${c.nome} é melhor.`

  return {
    title,
    description,
    alternates: { canonical: `/vs/${c.slug}` },
    openGraph: {
      title,
      description,
      url: `/vs/${c.slug}`,
      images: [{ url: `/api/og?title=${encodeURIComponent(`Anfitrião vs ${c.nome}`)}` }],
    },
  }
}

function Celula({ v }: { v: boolean | 'parcial' }) {
  if (v === 'parcial') {
    return (
      <>
        <Minus className="mx-auto h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <span className="sr-only">Parcial</span>
      </>
    )
  }
  return v ? (
    <>
      <Check className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <span className="sr-only">Sim</span>
    </>
  ) : (
    <>
      <X className="mx-auto h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
      <span className="sr-only">Não</span>
    </>
  )
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = comparacaoPorSlug(slug)
  if (!c) notFound()

  const outros = CONCORRENTES.filter(o => o.slug !== c.slug)

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">A</div>
            <span className="text-lg font-bold tracking-tight">Anfitrião</span>
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Começar grátis
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <nav aria-label="Migalhas" className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Início</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-foreground">Anfitrião vs {c.nome}</span>
        </nav>

        <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
          Anfitrião <span className="text-muted-foreground">vs</span> {c.nome}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{c.tagline}</p>

        {/* Preço em destaque */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Anfitrião</div>
            <p className="mt-3 text-2xl font-bold">Preço por conta</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Pagas pela conta, não por alojamento. Sem comissão sobre reservas, sem contrato,
              sem taxa de implementação.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{c.nome}</div>
            <p className="mt-3 text-2xl font-bold">{c.precoResumo}</p>
            <p className="mt-2 text-sm text-muted-foreground">{c.precoNota}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Preços do {c.nome} verificados em{' '}
          <time dateTime={PRECOS_VERIFICADOS_EM}>
            {new Date(PRECOS_VERIFICADOS_EM).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}
          </time>{' '}
          em{' '}
          <a href={c.fonte} rel="nofollow noopener external" target="_blank" className="underline hover:text-foreground">
            {new URL(c.fonte).hostname}
          </a>
          . Podem ter mudado desde então — confirma sempre na fonte.
        </p>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">O que é o {c.nome}</h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{c.posicionamento}</p>
        </section>

        {/* Onde eles ganham — primeiro, deliberadamente */}
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Onde o {c.nome} é melhor do que nós</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Começamos por aqui porque uma comparação que só nos elogia não vale nada.
          </p>
          <ul className="mt-6 space-y-3">
            {c.ondeElesGanham.map(t => (
              <li key={t} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="text-sm leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">Onde o Anfitrião é melhor</h2>
          <ul className="mt-6 space-y-3">
            {c.ondeNosGanhamos.map(t => (
              <li key={t} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-sm leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">Lado a lado</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">Comparação de funcionalidades entre o Anfitrião e o {c.nome}</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-3 text-left font-semibold">Funcionalidade</th>
                  <th scope="col" className="w-28 py-3 text-center font-semibold text-primary">Anfitrião</th>
                  <th scope="col" className="w-28 py-3 text-center font-semibold">{c.nome}</th>
                </tr>
              </thead>
              <tbody>
                {c.tabela.map(l => (
                  <tr key={l.label} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      {l.label}
                      {l.nota && <span className="mt-1 block text-xs text-muted-foreground">{l.nota}</span>}
                    </td>
                    <td className="py-3 text-center"><Celula v={l.nos} /></td>
                    <td className="py-3 text-center"><Celula v={l.eles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <Minus className="inline h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" /> significa
            parcial ou em desenvolvimento.
          </p>
        </section>

        <section className="mt-14 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Veredito</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">{c.veredito}</p>
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold">Quando não deves escolher o Anfitrião</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.naoEscolhasNos}</p>
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10 text-center">
          <h2 className="text-2xl font-bold">Experimenta sem cartão de crédito</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Liga o teu calendário do Airbnb ou do Booking.com e vê o teu primeiro check-in online a
            funcionar. Se não for para ti, sais sem custo.
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            Criar conta grátis →
          </Link>
        </section>

        <section className="mt-14">
          <h2 className="text-lg font-bold">Comparar com outras plataformas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {outros.map(o => (
              <Link
                key={o.slug}
                href={`/vs/${o.slug}`}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40"
              >
                Anfitrião vs {o.nome}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-6 py-8 text-xs text-muted-foreground">
          <p>
            Comparação elaborada com informação pública dos concorrentes à data indicada. As marcas
            mencionadas pertencem aos respetivos titulares e não têm qualquer relação com o Anfitrião.
            Encontraste algo incorreto?{' '}
            <a href="mailto:suporte@anfitrioes.pt" className="underline hover:text-foreground">Diz-nos</a> e corrigimos.
          </p>
          <p className="mt-4">© {new Date().getFullYear()} Anfitrião · Feito em Portugal</p>
        </div>
      </footer>
    </div>
  )
}

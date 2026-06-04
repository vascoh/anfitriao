import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Anfitrião — Gestão de Alojamento Local sem stress',
  description: 'Sincroniza Airbnb e Booking.com, faz check-in online, gera relatórios e responde hóspedes com IA. Começa grátis hoje.',
}

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/hoje')

  return (
    <div className="min-h-dvh bg-background text-foreground">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">A</div>
            <span className="text-lg font-bold tracking-tight">Anfitrião</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link href="/sign-up" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Começar grátis
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-32">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            ✦ 14 dias grátis · Sem cartão de crédito
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Gere o teu Alojamento Local{' '}
            <span className="text-primary">sem stress</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Sincroniza Airbnb e Booking.com, faz check-in online legal, acompanha reservas e receitas — tudo num só lugar.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/sign-up" className="w-full rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors sm:w-auto">
              Criar conta grátis →
            </Link>
            <Link href="/sign-in" className="w-full rounded-xl border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-muted transition-colors sm:w-auto">
              Já tenho conta
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400/60" />
            <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
            <div className="h-3 w-3 rounded-full bg-green-400/60" />
            <span className="ml-3 text-xs text-muted-foreground">anfitrioes.pt/hoje</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">
            {[
              { label: 'Chegadas hoje', value: '3', color: 'text-primary' },
              { label: 'Saídas hoje', value: '1', color: 'text-foreground' },
              { label: 'Em casa', value: '7', color: 'text-emerald-400' },
              { label: 'Reservas pendentes', value: '2', color: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-border bg-background p-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Próximas chegadas</div>
            {[
              { nome: 'João Silva', prop: 'Quarto Azul', data: 'Hoje, 15h00', flag: '🇵🇹' },
              { nome: 'Marie Dubois', prop: 'Estúdio Rio', data: 'Hoje, 17h30', flag: '🇫🇷' },
              { nome: 'James Wilson', prop: 'Apartamento T2', data: 'Amanhã, 14h00', flag: '🇬🇧' },
            ].map(r => (
              <div key={r.nome} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                <div className="text-xl">{r.flag}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{r.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.prop}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{r.data}</div>
                <div className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">SIBA ✓</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ────────────────────────────────── */}
      <section id="funcionalidades" className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center mb-16">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Funcionalidades</div>
            <h2 className="text-3xl font-bold md:text-4xl">Tudo o que precisas para gerir o teu AL</h2>
            <p className="mt-4 text-muted-foreground">Construído especificamente para anfitriões portugueses de Alojamento Local.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: '🔄',
                title: 'Sync Airbnb & Booking.com',
                desc: 'Liga os teus calendários via iCal. As reservas das plataformas aparecem automaticamente e os bloqueios de datas são enviados de volta.',
              },
              {
                icon: '📱',
                title: 'Check-in online',
                desc: 'Os teus hóspedes fazem o registo antecipado pelo telemóvel. Os dados SIBA ficam prontos antes da chegada, sem papelada.',
              },
              {
                icon: '📊',
                title: 'Relatórios de receita',
                desc: 'RevPAR, taxa de ocupação, receita por plataforma, comparação com ano anterior. Tudo actualizado em tempo real.',
              },
              {
                icon: '🤖',
                title: 'Concierge com IA',
                desc: 'Gera respostas profissionais para os teus hóspedes em português, inglês, francês e mais. Com o contexto do teu alojamento.',
              },
              {
                icon: '💰',
                title: 'Sistema de preços',
                desc: 'Define regras de preço por época, fim-de-semana, estadia mínima e desconto por plataforma. Automático e flexível.',
              },
              {
                icon: '🏠',
                title: 'Site de reservas diretas',
                desc: 'O teu próprio site de reservas em anfitrioes.pt/r/[o-teu-nome]. Partilha com os teus hóspedes e evita as comissões das OTAs.',
              },
            ].map(f => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Preços ─────────────────────────────────────────── */}
      <section id="precos" className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center mb-16">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Preços</div>
          <h2 className="text-3xl font-bold md:text-4xl">Simples e transparente</h2>
          <p className="mt-4 text-muted-foreground">Começa grátis. Sem surpresas, sem comissões sobre reservas.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
          {/* Trial */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold text-muted-foreground mb-4">Trial</div>
            <div className="text-4xl font-bold mb-1">Grátis</div>
            <div className="text-sm text-muted-foreground mb-6">14 dias, sem cartão</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8">
              {['1 propriedade', 'Todas as funcionalidades', 'Sync Airbnb/Booking', 'Check-in online'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-primary">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/sign-up" className="block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:bg-muted transition-colors">
              Começar trial
            </Link>
          </div>

          {/* Starter — destacado */}
          <div className="rounded-2xl border-2 border-primary bg-card p-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
              Mais popular
            </div>
            <div className="text-sm font-semibold text-primary mb-4">Starter</div>
            <div className="text-4xl font-bold mb-1">€15<span className="text-lg font-normal text-muted-foreground">/mês</span></div>
            <div className="text-sm text-muted-foreground mb-6">Faturado mensalmente</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8">
              {['Até 5 propriedades', 'Reservas ilimitadas', 'Relatórios avançados', 'Suporte prioritário', 'AI Concierge'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-primary">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/sign-up" className="block w-full rounded-xl bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
              Começar agora
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="text-sm font-semibold text-muted-foreground mb-4">Pro</div>
            <div className="text-4xl font-bold mb-1">€25<span className="text-lg font-normal text-muted-foreground">/mês</span></div>
            <div className="text-sm text-muted-foreground mb-6">Faturado mensalmente</div>
            <ul className="space-y-2.5 text-sm text-muted-foreground mb-8">
              {['Propriedades ilimitadas', 'Multi-utilizador', 'API access', 'Custom domain', 'Suporte dedicado'].map(f => (
                <li key={f} className="flex items-center gap-2"><span className="text-primary">✓</span>{f}</li>
              ))}
            </ul>
            <Link href="/sign-up" className="block w-full rounded-xl border border-border py-2.5 text-center text-sm font-semibold hover:bg-muted transition-colors">
              Começar trial
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Final ──────────────────────────────────────── */}
      <section className="border-t border-border bg-card/30">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Pronto para simplificar a gestão do teu AL?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Junta-te a anfitriões que já poupam horas por semana com o Anfitrião.
          </p>
          <Link href="/sign-up" className="mt-8 inline-flex rounded-xl bg-primary px-10 py-4 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors">
            Criar conta grátis — 14 dias sem compromisso
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito. Cancela quando quiseres.</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-6 w-6 place-items-center rounded bg-primary text-primary-foreground text-xs font-bold">A</div>
            <span className="text-sm font-semibold">Anfitrião</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <a href="mailto:suporte@anfitrioes.pt" className="hover:text-foreground transition-colors">suporte@anfitrioes.pt</a>
            <Link href="/sign-in" className="hover:text-foreground transition-colors">Login</Link>
            <Link href="/sign-up" className="hover:text-foreground transition-colors">Registar</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Anfitrião. Feito em Portugal 🇵🇹</p>
        </div>
      </footer>

    </div>
  )
}

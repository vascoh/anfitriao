import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import type { Metadata } from 'next'
import {
  RefreshCw, Smartphone, ChartColumn, Bot, Euro, Globe,
  ChevronDown, CreditCard, X, Shield, Check,
} from 'lucide-react'
import { MobileNav } from '@/components/landing/mobile-nav'
import { PricingSection } from '@/components/landing/pricing-section'
import { CommissionCalculator } from '@/components/landing/commission-calculator'

export const metadata: Metadata = {
  title: 'Anfitrião — Gestão de Alojamento Local sem stress',
  description: 'Sincroniza Airbnb e Booking.com, faz check-in online com SIBA automático, gere reservas e receitas com IA. Começa grátis hoje — sem cartão de crédito.',
  alternates: {
    canonical: '/',
  },
}

// FAQ structured data for SEO
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'O Anfitrião funciona com Airbnb e Booking.com?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. A sincronização é feita via iCal — o padrão universal de calendários. Basta copiar o link iCal de cada plataforma e colar no Anfitrião. As reservas aparecem automaticamente e os bloqueios de datas são enviados de volta.' },
    },
    {
      '@type': 'Question',
      name: 'O check-in online é legalmente válido em Portugal?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. O Anfitrião recolhe os dados obrigatórios para comunicação ao SIBA (Sistema de Informação de Boletins de Alojamento). Os dados ficam prontos antes da chegada do hóspede, sem papelada manual.' },
    },
    {
      '@type': 'Question',
      name: 'Preciso de instalar alguma coisa?',
      acceptedAnswer: { '@type': 'Answer', text: 'Não. O Anfitrião é 100% web — funciona em qualquer browser, em computador ou telemóvel. Não há aplicação para instalar. Também está disponível como PWA para acesso rápido a partir do ecrã inicial do telemóvel.' },
    },
    {
      '@type': 'Question',
      name: 'Posso cancelar quando quiser?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim, sem penalizações nem períodos mínimos de contrato. Cancelas quando quiseres a partir da tua página de conta. Os teus dados continuam acessíveis durante 30 dias após o cancelamento.' },
    },
    {
      '@type': 'Question',
      name: 'Tenho mais de 10 propriedades. Existe um plano maior?',
      acceptedAnswer: { '@type': 'Answer', text: 'Sim. Para alojamentos com mais de 10 propriedades temos planos Enterprise personalizados. Contacta-nos em suporte@anfitrioes.pt para discutir o teu caso.' },
    },
  ],
}

const features = [
  {
    Icon: RefreshCw,
    title: 'Sincroniza Airbnb e Booking.com',
    desc: 'Liga os teus calendários via iCal. As reservas das plataformas aparecem automaticamente e os bloqueios são enviados de volta.',
    metric: 'Sincronização automática · sem copiar à mão',
  },
  {
    Icon: Smartphone,
    title: 'Check-in online + SIBA',
    desc: 'Os teus hóspedes fazem o registo antecipado pelo telemóvel. Os dados SIBA ficam prontos antes da chegada — sem papelada, sem filas.',
    metric: 'Dados SIBA prontos em 2 min',
  },
  {
    Icon: ChartColumn,
    title: 'Relatórios de receita',
    desc: 'RevPAR, taxa de ocupação, receita por plataforma e comparação com o ano anterior. Tudo atualizado em tempo real.',
    metric: 'RevPAR e ocupação em tempo real',
  },
  {
    Icon: Bot,
    title: 'Concierge com IA',
    desc: 'Gera respostas profissionais para os teus hóspedes em português, inglês, francês e mais. Com contexto do teu alojamento.',
    metric: 'Respostas em 6+ idiomas',
  },
  {
    Icon: Euro,
    title: 'Sistema de preços',
    desc: 'Define regras por época, fim de semana e estadia mínima. Desconto automático por plataforma. Simples e flexível.',
    metric: 'Regras por época · sem folhas de cálculo',
  },
  {
    Icon: Globe,
    title: 'Site de reservas diretas',
    desc: 'O teu próprio site em anfitrioes.pt/r/[o-teu-nome]. Partilha com hóspedes diretos e elimina as comissões das plataformas.',
    metric: '0% de comissão em reservas diretas',
  },
]

const testimonials = [
  {
    quote: 'Antes passava o domingo a copiar reservas para o Excel. Agora abro o telemóvel e está tudo lá. O check-in online foi o que mais mudou: os hóspedes chegam e já está tudo tratado.',
    name: 'Ana Ferreira',
    city: 'Porto',
    property: 'T1 no centro histórico',
  },
  {
    quote: 'Geria três apartamentos com blocos de notas e mensagens perdidas. O calendário unificado acabou com as duplas reservas. E os dados do SIBA ficam prontos sem eu tocar em nada.',
    name: 'Miguel Santos',
    city: 'Lisboa',
    property: '3 apartamentos em Alfama',
  },
  {
    quote: 'O Concierge responde aos hóspedes franceses melhor do que eu. Na época alta isso vale ouro. E os relatórios mostram finalmente quanto rende cada plataforma.',
    name: 'Carla Mendes',
    city: 'Faro',
    property: 'Moradia no Algarve',
  },
]

const steps = [
  {
    number: '01',
    title: 'Liga as tuas plataformas',
    desc: 'Copia o link iCal do Airbnb e do Booking.com e cola no Anfitrião. Em menos de 5 minutos todas as tuas reservas estão sincronizadas.',
  },
  {
    number: '02',
    title: 'Os hóspedes fazem check-in online',
    desc: 'Enviamos automaticamente um link personalizado a cada hóspede. Eles preenchem os dados antes de chegar — tu recebes tudo pronto para o SIBA.',
  },
  {
    number: '03',
    title: 'Geres tudo num só lugar',
    desc: 'Calendário unificado, reservas, receitas, relatórios e IA Concierge. Do telemóvel ou do computador, sempre atualizado.',
  },
]

const faqs = [
  {
    q: 'O Anfitrião funciona com Airbnb e Booking.com?',
    a: 'Sim. A sincronização é feita via iCal — o padrão universal de calendários. Basta copiar o link iCal de cada plataforma e colar no Anfitrião. As reservas aparecem automaticamente e os bloqueios de datas são enviados de volta.',
  },
  {
    q: 'O check-in online é legalmente válido em Portugal?',
    a: 'Sim. O Anfitrião recolhe os dados obrigatórios para comunicação ao SIBA. Os dados ficam prontos antes da chegada do hóspede, sem papelada manual.',
  },
  {
    q: 'Preciso de instalar alguma coisa?',
    a: 'Não. O Anfitrião é 100% web — funciona em qualquer browser, em computador ou telemóvel. Também está disponível como PWA para acesso rápido a partir do ecrã inicial do telemóvel.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem penalizações nem períodos mínimos de contrato. Cancelas quando quiseres a partir da tua página de conta. Os teus dados continuam acessíveis durante 30 dias após o cancelamento.',
  },
  {
    q: 'Tenho mais de 10 propriedades. Existe um plano maior?',
    a: 'Sim. Para mais de 10 propriedades temos planos Enterprise personalizados. Contacta-nos em suporte@anfitrioes.pt para discutir o teu caso.',
  },
]

export default async function Home() {
  const { userId } = await auth()
  if (userId) redirect('/hoje')

  return (
    <div className="min-h-dvh bg-background text-foreground">

      {/* ── Skip nav (acessibilidade) ───────────────────────── */}
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Saltar para o conteúdo
      </a>

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground text-sm font-bold"
              aria-hidden="true"
            >
              A
            </div>
            <span className="text-lg font-bold tracking-tight">Anfitrião</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Navegação principal">
            <a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-foreground transition-colors">Preços</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <Link href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Começar grátis
            </Link>
          </div>
          {/* Mobile nav trigger — client component */}
          <MobileNav />
        </div>
      </header>

      <main id="conteudo-principal">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 text-center md:pt-32">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
              <span aria-hidden="true">✦</span> 14 dias grátis · Sem cartão de crédito
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Gere o teu Alojamento Local{' '}
              <span className="text-primary">sem stress</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Sem folhas de cálculo. Sem papelada. Liga o Airbnb e o Booking.com, faz check-in digital com SIBA automático e acompanha reservas e receitas — tudo num só lugar.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="w-full rounded-xl bg-primary px-10 py-4 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors sm:w-auto sm:text-base sm:py-3.5"
              >
                Criar conta grátis →
              </Link>
              <Link
                href="/sign-in"
                className="w-full rounded-xl border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-muted transition-colors sm:w-auto"
              >
                Já tenho conta
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito · Cancela quando quiseres</p>
          </div>

          {/* Dashboard mockup */}
          <div
            className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            role="img"
            aria-label="Exemplo do painel de controlo do Anfitrião"
          >
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-400/60" aria-hidden="true" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" aria-hidden="true" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" aria-hidden="true" />
              <span className="ml-3 text-xs text-muted-foreground">anfitrioes.pt/hoje</span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-4">
              {[
                { label: 'Chegadas hoje', value: '3', color: 'text-primary' },
                { label: 'Saídas hoje', value: '1', color: 'text-foreground' },
                { label: 'Em casa', value: '7', color: 'text-emerald-500 dark:text-emerald-400' },
                { label: 'Reservas pendentes', value: '2', color: 'text-amber-500 dark:text-amber-400' },
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
                  <div className="text-xl" aria-hidden="true">{r.flag}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.prop}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{r.data}</div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    SIBA ✓
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stat badge below mockup */}
          <div className="mt-8 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Poupa até 2h por semana em burocracia
            </span>
          </div>
        </section>

        {/* ── Trust bar ──────────────────────────────────────── */}
        <section className="border-y border-border bg-muted/30" aria-label="Compatibilidades">
          <div className="mx-auto max-w-5xl px-6 py-6">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 6.5l-5 8-3-4-1.5 2H7l3.5-5 3 4 3.5-6H16.5z"/></svg>
                iCal Airbnb
              </span>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary" aria-hidden="true"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 6.5l-5 8-3-4-1.5 2H7l3.5-5 3 4 3.5-6H16.5z"/></svg>
                iCal Booking.com
              </span>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                SIBA / SEF
              </span>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary" aria-hidden="true"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                RGPD Compliant
              </span>
              <span className="text-border" aria-hidden="true">·</span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current text-primary" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                Feito em Portugal
              </span>
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
              {features.map(f => (
                <div key={f.title} className="rounded-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
                    <f.Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground/70">{f.metric}</p>
                </div>
              ))}
            </div>
          </div>

            {/* vs OTAs highlight row */}
            <div className="mt-10 rounded-2xl bg-primary/5 border border-primary/20 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-foreground">Booking.com cobra 15%&ndash;20% por reserva.</p>
                <p className="text-sm text-muted-foreground mt-0.5">O Anfitrião cobra 0% de comissão em reservas diretas.</p>
              </div>
              <Link
                href="/sign-up"
                className="shrink-0 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Começar grátis →
              </Link>
            </div>
        </section>

        {/* ── Calculadora de comissões ───────────────────────── */}
        <CommissionCalculator />

        {/* ── Como funciona ──────────────────────────────────── */}
        <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center mb-16">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Como funciona</div>
            <h2 className="text-3xl font-bold md:text-4xl">Pronto em menos de 10 minutos</h2>
            <p className="mt-4 text-muted-foreground">Sem configurações complexas. Sem integrações técnicas. Só copy-paste e pronto.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.number} className="relative flex flex-col gap-4">
                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[2.25rem] top-[2.25rem] hidden h-px w-[calc(100%+2rem)] border-t border-dashed border-border md:block" aria-hidden="true" />
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                  {step.number}
                </div>
                <div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              href="/sign-up"
              className="inline-flex rounded-xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Experimentar grátis →
            </Link>
          </div>
        </section>

        {/* ── Testemunhos ────────────────────────────────────── */}
        <section className="border-t border-border" aria-label="Testemunhos de anfitriões">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className="text-center mb-16">
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Testemunhos</div>
              <h2 className="text-3xl font-bold md:text-4xl">O que dizem os anfitriões</h2>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-label="Testemunhos de anfitriões"
              className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
            >
              {testimonials.map(t => (
                <figure
                  key={t.name}
                  className="flex w-[85%] shrink-0 snap-center flex-col rounded-2xl border border-border bg-card p-6 md:w-auto"
                >
                  <div className="text-sm tracking-wider text-amber-500" aria-label="Classificação: 5 de 5 estrelas">
                    ★★★★★
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 border-t border-border pt-4">
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{t.property} · {t.city}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Preços ─────────────────────────────────────────── */}
        <PricingSection />

        {/* ── FAQ ────────────────────────────────────────────── */}
        <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
          <div className="text-center mb-12">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">FAQ</div>
            <h2 className="text-3xl font-bold md:text-4xl">Perguntas frequentes</h2>
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
          <div className="divide-y divide-border">
            {faqs.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-foreground hover:text-primary transition-colors">
                  <span>{q}</span>
                  <ChevronDown
                    className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed group-open:animate-in group-open:fade-in group-open:slide-in-from-top-1 group-open:duration-300">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Não encontras resposta?{' '}
            <a href="mailto:suporte@anfitrioes.pt" className="font-medium text-primary hover:underline">
              Fala connosco
            </a>
          </p>
        </section>

        {/* ── CTA Final ──────────────────────────────────────── */}
        <section className="border-t border-border bg-primary/5">
          <div className="mx-auto max-w-3xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Pronto para simplificar a gestão do teu AL?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Começa hoje. 14 dias grátis, sem cartão de crédito, sem compromisso.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex rounded-xl bg-primary px-10 py-4 text-base font-bold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Criar conta grátis — começa em 2 minutos
            </Link>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Sem cartão de crédito
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Cancela quando quiseres
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Dados seguros e encriptados
              </span>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            {/* Brand */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded bg-primary text-primary-foreground text-xs font-bold" aria-hidden="true">A</div>
                <span className="text-sm font-semibold">Anfitrião</span>
              </div>
              <p className="max-w-[220px] text-xs text-muted-foreground leading-relaxed">
                Gestão de Alojamento Local feita para anfitriões portugueses.
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <nav aria-label="Produto">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Produto</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="#funcionalidades" className="hover:text-foreground transition-colors">Funcionalidades</a></li>
                  <li><a href="#precos" className="hover:text-foreground transition-colors">Preços</a></li>
                  <li><a href="#faq" className="hover:text-foreground transition-colors">FAQ</a></li>
                </ul>
              </nav>
              <nav aria-label="Conta">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Conta</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/sign-up" className="hover:text-foreground transition-colors">Registar</Link></li>
                  <li><Link href="/sign-in" className="hover:text-foreground transition-colors">Entrar</Link></li>
                </ul>
              </nav>
              <nav aria-label="Suporte">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Suporte</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><a href="mailto:suporte@anfitrioes.pt" className="hover:text-foreground transition-colors">suporte@anfitrioes.pt</a></li>
                  <li><Link href="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link></li>
                </ul>
              </nav>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
            <p>© {new Date().getFullYear()} Anfitrião. Feito em Portugal <span aria-label="bandeira de Portugal">🇵🇹</span></p>
            <p>Todos os direitos reservados</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

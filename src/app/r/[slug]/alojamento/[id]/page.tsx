import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  ArrowLeft, Car, Check, MapPin, Tv, Trees, UtensilsCrossed, Waves, WashingMachine, Wifi, Wind,
} from 'lucide-react'
import { fmtMoney } from '@/lib/utils'
import {
  adminGetBookings, adminGetPlatformRates, adminGetPriceRules, adminGetProperties, adminGetTarifas,
  adminGetWebsiteSettingsBySlug,
} from '@/lib/db-admin'
import { getAccountByClerkId } from '@/lib/accounts'
import { blockedDates } from '@/lib/reservations'
import { acessoAoSite } from '@/lib/site-acesso'
import { siteTheme } from '@/lib/site-theme'
import { basePathDoSite, baseUrlDoSite } from '@/lib/site-request'
import { resolveLang, htmlLang } from '@/lib/i18n'
import { tr } from '@/lib/i18n-reserva'
import { nomeComodidade } from '@/lib/comodidades'
import { dadosDoCartao, fotosDe, quartosDe } from '@/lib/site-alojamentos'
import { propriedadePublica, propriedadesPublicas, ocupacoesPublicas } from '@/lib/property-publica'
import { paragrafos } from '@/lib/site-mapa'
import CasaInteiraClient from '@/app/book/[propertyId]/CasaInteiraClient'
import { SiteNav, SiteFooter } from '../../_components/site-chrome'
import { Galeria } from '../../_components/galeria'
import { Reservar } from '../../_components/reservar'
import { CartaoAlojamento } from '../../_components/cartao-alojamento'

const ICONE: Record<string, ReactNode> = {
  wifi: <Wifi className="h-4 w-4" />,
  ar_condicionado: <Wind className="h-4 w-4" />,
  estacionamento: <Car className="h-4 w-4" />,
  piscina: <Waves className="h-4 w-4" />,
  cozinha: <UtensilsCrossed className="h-4 w-4" />,
  maquina_lavar: <WashingMachine className="h-4 w-4" />,
  tv: <Tv className="h-4 w-4" />,
  jardim: <Trees className="h-4 w-4" />,
}

type Params = { params: Promise<{ slug: string; id: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings?.owner_id) return { title: 'Reservas' }
  const prop = (await adminGetProperties(settings.owner_id)).find(p => p.id === id && p.ativo)
  if (!prop) return { title: { absolute: settings.nome } }
  const siteUrl = await baseUrlDoSite(slug)
  const capa = fotosDe(prop)[0]
  return {
    title: { absolute: `${prop.nome} — ${settings.nome}` },
    description: (prop.descricao || settings.descricao || '').slice(0, 160) || undefined,
    openGraph: capa ? { images: [{ url: capa, alt: prop.nome }] } : undefined,
    alternates: { canonical: `${siteUrl}/alojamento/${id}` },
    robots: { index: false, follow: false },
  }
}

export default async function AlojamentoPage({ params }: Params) {
  const { slug, id } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings?.owner_id) notFound()
  if (!(await acessoAoSite(settings)).pode) notFound()

  const lang = resolveLang(settings.idioma)
  const theme = siteTheme(settings)
  const basePath = await basePathDoSite(slug)
  const ownerId = settings.owner_id
  const todas = await adminGetProperties(ownerId)
  const prop = todas.find(p => p.id === id && p.ativo)
  if (!prop) notFound()

  const quartos = quartosDe(prop.id, todas)
  const casa = prop.parent_id ? todas.find(p => p.id === prop.parent_id && p.ativo) ?? null : null
  const fotos = fotosDe(prop)

  const [reservas, rules, tarifas, rates, conta] = await Promise.all([
    adminGetBookings(ownerId),
    adminGetPriceRules(ownerId),
    adminGetTarifas(ownerId),
    adminGetPlatformRates(ownerId),
    getAccountByClerkId(ownerId),
  ])

  const meta = [
    `${prop.capacidade} ${prop.capacidade === 1 ? tr(lang, 'hospede') : tr(lang, 'hospedes')}`,
    prop.quartos > 0 ? `${prop.quartos} ${prop.quartos === 1 ? tr(lang, 'cama') : tr(lang, 'camas')}` : null,
    prop.casasBanho > 0 ? `${prop.casasBanho} ${prop.casasBanho === 1 ? tr(lang, 'wc1') : tr(lang, 'wc')}` : null,
  ].filter(Boolean)
  const descricao = prop.descricao ? paragrafos(prop.descricao) : []

  /* Sem a lista completa de reservas não se mostra calendário: uma leitura
   * falhada mostraria como livre o que já está vendido (ver /book). */
  const semCalendario = Boolean(reservas.erro)
  const precoDesde = quartos.length > 0 ? Math.min(...quartos.map(q => q.preco_base)) : prop.preco_base

  return (
    <div lang={htmlLang(lang)} className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 pb-28 pt-6 sm:pt-10 lg:pb-24">
        <header className="flex flex-col gap-3">
          {casa && (
            <Link href={`${basePath}/alojamento/${casa.id}`}
              className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {tr(lang, 'voltar_casa', { nome: casa.nome })}
            </Link>
          )}
          <h1 className="site-titulo text-3xl font-semibold sm:text-5xl">{prop.nome}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {meta.map(m => <span key={m}>{m}</span>)}
            {prop.cidade && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{prop.cidade}</span>}
          </p>
        </header>

        <Galeria fotos={fotos} nome={prop.nome} cor={prop.cor} lang={lang} />

        <div className={`grid grid-cols-1 gap-12 ${quartos.length === 0 ? 'lg:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
          <div className="flex min-w-0 flex-col gap-10">
            {descricao.length > 0 && (
              <div className="flex max-w-prose flex-col gap-4 text-[15px] leading-7 text-foreground/85">
                {descricao.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
              </div>
            )}

            {prop.comodidades.length > 0 && (
              <section className="flex flex-col gap-4 border-t border-border pt-8">
                <h2 className="site-titulo text-xl font-semibold">{tr(lang, 'comodidades')}</h2>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {prop.comodidades.map(c => (
                    <li key={c} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{ICONE[c] ?? <Check className="h-4 w-4" />}</span>
                      {nomeComodidade(c, lang)}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {prop.regras_casa && (
              <section className="flex flex-col gap-3 border-t border-border pt-8">
                <h2 className="site-titulo text-xl font-semibold">{tr(lang, 'regras')}</h2>
                <p className="max-w-prose whitespace-pre-line text-sm leading-6 text-muted-foreground">{prop.regras_casa}</p>
              </section>
            )}

            {quartos.length > 0 && (
              <section className="flex flex-col gap-6 border-t border-border pt-8">
                <div className="flex flex-col gap-1">
                  <h2 className="site-titulo text-2xl font-semibold">{tr(lang, 'quartos_titulo')}</h2>
                  <p className="max-w-prose text-sm text-muted-foreground">{tr(lang, 'quartos_texto')}</p>
                </div>
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
                  {quartos.map(q => (
                    <CartaoAlojamento key={q.id} a={dadosDoCartao(q, todas)} href={`${basePath}/alojamento/${q.id}`} lang={lang} />
                  ))}
                </div>
                {!semCalendario && (
                  <CasaInteiraClient
                    casa={propriedadePublica(prop)}
                    quartos={propriedadesPublicas(quartos)}
                    ocupacoes={ocupacoesPublicas(reservas.linhas)}
                    priceRules={rules}
                    tarifas={tarifas}
                    platformRates={rates}
                    minNoites={settings.min_noites ?? 1}
                  />
                )}
              </section>
            )}
          </div>

          {quartos.length === 0 && (
            <aside id="reservar" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
              {semCalendario ? (
                <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{tr(lang, 'indisponivel')}</p>
              ) : (
                <Reservar
                  prop={propriedadePublica(prop)}
                  ocupadas={[...blockedDates(reservas.linhas, prop.id)]}
                  priceRules={rules}
                  tarifas={tarifas}
                  platformRates={rates}
                  minNoites={settings.min_noites ?? 1}
                  antecedenciaDias={settings.antecedencia_dias ?? 0}
                  pagamentos={Boolean(conta?.stripe_connect_charges_enabled)}
                  lang={lang}
                />
              )}
            </aside>
          )}
        </div>
      </main>

      {quartos.length === 0 && !semCalendario && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <p className="text-xs text-muted-foreground">
            {tr(lang, 'desde')} <span className="site-num text-base font-semibold text-foreground">{fmtMoney(precoDesde)}</span> / {tr(lang, 'noite')}
          </p>
          <a href="#reservar" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            {tr(lang, 'ver_datas')}
          </a>
        </div>
      )}

      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}

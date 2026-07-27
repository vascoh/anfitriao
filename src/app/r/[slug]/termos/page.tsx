import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { APP_URL } from '@/lib/config'
import { SiteNav, SiteFooter } from '../_components/site-chrome'
import { LegalPage } from '../_components/legal-page'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return {
    title: settings ? `Termos e Condições — ${settings.nome}` : 'Termos',
    alternates: { canonical: `${APP_URL}/r/${slug}/termos` },
    robots: { index: false, follow: false },
  }
}

export default async function TermosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="" />
      <LegalPage title="Termos e Condições">
        <p>Ao efetuar uma reserva através deste site, aceitas os seguintes termos junto de <strong>{settings.nome}</strong>.</p>
        <h2>Reservas</h2>
        <p>Todas as reservas feitas diretamente estão sujeitas a confirmação do anfitrião. O pagamento e as condições de cancelamento são acordados diretamente com o anfitrião no momento da confirmação.</p>
        <h2>Estadia mínima</h2>
        <p>{settings.min_noites > 1 ? `Este alojamento exige uma estadia mínima de ${settings.min_noites} noites.` : 'Não há estadia mínima obrigatória, salvo indicação em contrário no momento da reserva.'}</p>
        <h2>Check-in e obrigações legais</h2>
        <p>Todos os hóspedes devem completar o check-in online e fornecer os dados de identificação exigidos por lei para comunicação às autoridades competentes.</p>
        <h2>Contacto</h2>
        <p>Para questões sobre a tua reserva, contacta {settings.email || settings.telefone || 'o anfitrião'} diretamente.</p>
      </LegalPage>
      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}

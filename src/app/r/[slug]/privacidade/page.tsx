import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { adminGetWebsiteSettingsBySlug } from '@/lib/db-admin'
import { siteTheme } from '@/lib/site-theme'
import { SiteNav, SiteFooter } from '../_components/site-chrome'
import { LegalPage } from '../_components/legal-page'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  return { title: settings ? `Política de Privacidade — ${settings.nome}` : 'Privacidade', robots: { index: false, follow: false } }
}

export default async function PrivacidadePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const settings = await adminGetWebsiteSettingsBySlug(slug)
  if (!settings || !settings.enabled) notFound()

  const theme = siteTheme(settings)
  const contacto = settings.email || settings.telefone || 'através dos contactos indicados neste site'

  return (
    <div className={`min-h-dvh bg-background flex flex-col ${theme.className}`} style={theme.style}>
      <SiteNav slug={slug} settings={settings} active="" />
      <LegalPage title="Política de Privacidade">
        <p>Esta política descreve como <strong>{settings.nome}</strong> trata os dados pessoais recolhidos através deste site e do processo de reserva.</p>
        <h2>Dados recolhidos</h2>
        <p>Ao efetuar uma reserva ou check-in online, recolhemos nome, contacto, datas de estadia e, quando legalmente exigido, dados do documento de identificação para cumprimento das obrigações de comunicação às autoridades (SEF/SIBA).</p>
        <h2>Finalidade</h2>
        <p>Os dados são usados exclusivamente para gerir a reserva, comunicar contigo sobre a estadia e cumprir obrigações legais de registo de hóspedes.</p>
        <h2>Partilha de dados</h2>
        <p>Os dados não são vendidos nem partilhados com terceiros, exceto quando exigido por lei (ex.: comunicação obrigatória às autoridades competentes).</p>
        <h2>Os teus direitos</h2>
        <p>Podes solicitar acesso, retificação ou eliminação dos teus dados a qualquer momento, contactando {contacto}.</p>
      </LegalPage>
      <SiteFooter slug={slug} settings={settings} />
    </div>
  )
}

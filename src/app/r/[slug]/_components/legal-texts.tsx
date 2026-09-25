import type { SiteLang } from '@/lib/i18n'

/*
 * Textos das páginas legais do site do anfitrião, em PT e EN.
 *
 * São o mesmo modelo genérico nas duas línguas — a versão inglesa é uma
 * tradução, não um texto com outras garantias. Mudar um obriga a mudar o
 * outro: um hóspede estrangeiro não pode ler condições diferentes das do
 * português.
 */

export function PrivacidadeTexto({ lang, nome, contacto }: { lang: SiteLang; nome: string; contacto: string | null }) {
  if (lang === 'en') {
    return (
      <>
        <p>This policy describes how <strong>{nome}</strong> handles the personal data collected through this website and during the booking process.</p>
        <h2>Data we collect</h2>
        <p>When you make a booking or complete the online check-in, we collect your name, contact details, stay dates and, where required by law, identity document details to meet the reporting obligations to the authorities (the accommodation registration form sent through SIBA, under the supervision of AIMA, the Portuguese agency for integration, migration and asylum).</p>
        <h2>Purpose</h2>
        <p>The data is used only to manage your booking, to contact you about your stay and to meet the legal obligations for registering guests.</p>
        <h2>Data sharing</h2>
        <p>Your data is not sold or shared with third parties, except where required by law (for example, the mandatory reporting to the competent authorities).</p>
        <h2>Your rights</h2>
        <p>You can ask to access, correct or erase your data at any time by contacting {contacto ?? 'us through the contact details on this website'}.</p>
      </>
    )
  }
  return (
    <>
      <p>Esta política descreve como <strong>{nome}</strong> trata os dados pessoais recolhidos através deste site e do processo de reserva.</p>
      <h2>Dados recolhidos</h2>
      <p>Ao efetuar uma reserva ou check-in online, recolhemos nome, contacto, datas de estadia e, quando legalmente exigido, dados do documento de identificação para cumprimento das obrigações de comunicação às autoridades (boletim de alojamento, entregue através do SIBA, sob a tutela da AIMA).</p>
      <h2>Finalidade</h2>
      <p>Os dados são usados exclusivamente para gerir a reserva, comunicar contigo sobre a estadia e cumprir obrigações legais de registo de hóspedes.</p>
      <h2>Partilha de dados</h2>
      <p>Os dados não são vendidos nem partilhados com terceiros, exceto quando exigido por lei (ex.: comunicação obrigatória às autoridades competentes).</p>
      <h2>Os teus direitos</h2>
      <p>Podes solicitar acesso, retificação ou eliminação dos teus dados a qualquer momento, contactando {contacto ?? 'através dos contactos indicados neste site'}.</p>
    </>
  )
}

export function CookiesTexto({ lang, nome }: { lang: SiteLang; nome: string }) {
  if (lang === 'en') {
    return (
      <>
        <p>This website only uses technical cookies that are essential to the booking process (for example, keeping the form data while you browse). We do not use advertising cookies or third-party tracking cookies.</p>
        <h2>What cookies are</h2>
        <p>Small files stored on your device that let the website work properly during your visit.</p>
        <h2>How to manage them</h2>
        <p>You can clear or block cookies in your browser settings at any time, and still contact {nome} directly.</p>
      </>
    )
  }
  return (
    <>
      <p>Este site usa apenas cookies técnicos essenciais ao funcionamento do processo de reserva (ex.: manter os dados do formulário durante a navegação). Não usamos cookies de publicidade ou de rastreio de terceiros.</p>
      <h2>O que são cookies</h2>
      <p>Pequenos ficheiros guardados no teu dispositivo que permitem ao site funcionar corretamente durante a tua visita.</p>
      <h2>Como gerir</h2>
      <p>Podes limpar ou bloquear cookies nas definições do teu browser a qualquer momento, sem afetar a tua capacidade de contactar {nome} diretamente.</p>
    </>
  )
}

export function TermosTexto(
  { lang, nome, minNoites, contacto }: { lang: SiteLang; nome: string; minNoites: number; contacto: string | null },
) {
  if (lang === 'en') {
    return (
      <>
        <p>By making a booking through this website, you accept the following terms with <strong>{nome}</strong>.</p>
        <h2>Bookings</h2>
        <p>All direct bookings are subject to confirmation by the host. Payment and cancellation terms are agreed directly with the host when the booking is confirmed.</p>
        <h2>Minimum stay</h2>
        <p>{minNoites > 1 ? `This accommodation requires a minimum stay of ${minNoites} nights.` : 'There is no minimum stay, unless stated otherwise at the time of booking.'}</p>
        <h2>Check-in and legal obligations</h2>
        <p>All guests must complete the online check-in and provide the identification details required by Portuguese law for reporting to the competent authorities.</p>
        <h2>Contact</h2>
        <p>For questions about your booking, contact {contacto ?? 'the host'} directly.</p>
      </>
    )
  }
  return (
    <>
      <p>Ao efetuar uma reserva através deste site, aceitas os seguintes termos junto de <strong>{nome}</strong>.</p>
      <h2>Reservas</h2>
      <p>Todas as reservas feitas diretamente estão sujeitas a confirmação do anfitrião. O pagamento e as condições de cancelamento são acordados diretamente com o anfitrião no momento da confirmação.</p>
      <h2>Estadia mínima</h2>
      <p>{minNoites > 1 ? `Este alojamento exige uma estadia mínima de ${minNoites} noites.` : 'Não há estadia mínima obrigatória, salvo indicação em contrário no momento da reserva.'}</p>
      <h2>Check-in e obrigações legais</h2>
      <p>Todos os hóspedes devem completar o check-in online e fornecer os dados de identificação exigidos por lei para comunicação às autoridades competentes.</p>
      <h2>Contacto</h2>
      <p>Para questões sobre a tua reserva, contacta {contacto ?? 'o anfitrião'} diretamente.</p>
    </>
  )
}
